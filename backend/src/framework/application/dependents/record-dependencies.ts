import { ApplyToRelatedRecords } from './apply-to-related-records';
import { CompositionOrderPropagator } from './composition-order-propagator';
import {
  CorrectableFields,
  CorrectionPropagator,
  RecordCorrection,
} from './correction-propagator';
import { DependentsProbe } from './dependents-probe';
import { RecordHasDependents } from './record-has-dependents.exception';
import {
  DEPENDENT_KINDS,
  DependentKind,
  DependentRecord,
  RecordDependent,
  RecordReference,
} from './record-reference';

/** An edit of a record that may be in use, as `editRecordInUse()` takes it. */
export interface EditOfRecordInUse {
  /** What the edit asked for, and whether it was granted. */
  readonly applyToRelatedRecords: ApplyToRelatedRecords;
  /** Whether the edit changes nothing but the record's correctable fields — the aggregate's answer. */
  readonly changesOnlyCorrectableFields: boolean;
  /** The record's correctable fields before the edit, and as the edit leaves them. */
  readonly before: CorrectableFields;
  readonly after: CorrectableFields;
  /**
   * Issue #122: when the edit lays the record's composition out in another
   * order and changes it no other way, the new order of component ids;
   * absent otherwise. `changesOnlyCorrectableFields` must then answer for
   * the rest of the edit, the reordering set aside.
   */
  readonly reorderedComposition?: readonly string[];
}

/**
 * The one rule of issue #94, applied the same way everywhere: a record that
 * another record directly references can be neither edited nor deleted. It
 * asks every registered `DependentsProbe` — one per module that holds
 * references — and gathers their answers per kind.
 *
 * Every edit and delete handler of a record that can be referenced calls
 * `assertNoDependents()` before it changes anything. A new feature that
 * references a record plugs in by registering a probe; nothing here changes.
 *
 * The probes are read on every call, not copied at construction, so a
 * registry filled once the application has initialised (see
 * `RecordDependenciesModule`) is seen whole. They are asked one at a time:
 * a probe may read on the write path's transaction, which must never run
 * queries concurrently.
 *
 * Issue #110 adds the System Admin's one way past the rule for an edit: a
 * granted correction of only the correctable fields, carried into every
 * related record by the `CorrectionPropagator`s, read and asked the same way
 * as the probes. `editRecordInUse()` is the one entry point, so a handler
 * cannot guard without propagating or the other way round.
 */
export class RecordDependencies {
  constructor(
    private readonly probes: Iterable<DependentsProbe>,
    private readonly propagators: Iterable<CorrectionPropagator> = [],
    private readonly orderPropagators: Iterable<CompositionOrderPropagator> = [],
  ) {}

  /**
   * Every record that references `reference`, per kind, in `DEPENDENT_KINDS`
   * order: each counted, the named ones listed, names sorted.
   */
  async dependentsOf(reference: RecordReference): Promise<RecordDependent[]> {
    const namesByKind = new Map<DependentKind, (string | null)[]>();
    for (const probe of this.probes) {
      for (const dependent of await probe.dependentsOf(reference)) {
        RecordDependencies.add(namesByKind, dependent);
      }
    }
    return DEPENDENT_KINDS.flatMap((kind) => {
      const names = namesByKind.get(kind) ?? [];
      return names.length === 0
        ? []
        : [
            {
              kind,
              count: names.length,
              names: names
                .filter((name): name is string => name !== null)
                .toSorted((a, b) => a.localeCompare(b, 'fa')),
            },
          ];
    });
  }

  /** Throws `RecordHasDependents` when any record references `reference`. */
  async assertNoDependents(reference: RecordReference): Promise<void> {
    const dependents = await this.dependentsOf(reference);
    if (dependents.length > 0) {
      throw RecordHasDependents.of(reference, dependents);
    }
  }

  /**
   * An edit of a record that may be in use (issue #110), whole: the guard,
   * then `write` (the caller's checks, the edit and its save), then — for a
   * granted correction — the changed name/code carried into every record
   * holding a snapshot of it. Call it inside the handler's unit of work, so
   * the save and every propagator commit or roll back together.
   *
   * A granted correction changing only correctable fields passes whatever
   * references the record; so does a reordering of its composition changing
   * nothing else (issue #122) — for anyone allowed to edit it — and one
   * riding along with a granted correction. Any other edit is held to
   * `assertNoDependents()` and writes nothing. After the write, a reordering
   * is carried into every snapshot of the composition by the
   * `CompositionOrderPropagator`s. A `write` that throws propagates nothing.
   */
  async editRecordInUse(
    reference: RecordReference,
    edit: EditOfRecordInUse,
    write: () => Promise<void>,
  ): Promise<void> {
    const correcting =
      edit.applyToRelatedRecords.isGranted() &&
      edit.changesOnlyCorrectableFields;
    const onlyReordering =
      edit.reorderedComposition !== undefined &&
      edit.changesOnlyCorrectableFields &&
      RecordDependencies.correctionIsEmpty(
        RecordDependencies.correctionOf(edit),
      );
    if (!correcting && !onlyReordering) {
      await this.assertNoDependents(reference);
    }
    await write();
    if (correcting) {
      await this.propagate(
        reference,
        RecordDependencies.correctionOf(edit),
        edit.before,
      );
    }
    if (edit.reorderedComposition !== undefined) {
      for (const propagator of this.orderPropagators) {
        await propagator.propagate(reference, edit.reorderedComposition);
      }
    }
  }

  /**
   * One propagator at a time (they write on the caller's transaction). A
   * correction that changed nothing asks none of them.
   */
  private async propagate(
    reference: RecordReference,
    correction: RecordCorrection,
    before: CorrectableFields,
  ): Promise<void> {
    if (RecordDependencies.correctionIsEmpty(correction)) {
      return;
    }
    for (const propagator of this.propagators) {
      await propagator.propagate(reference, correction, before);
    }
  }

  private static correctionIsEmpty(correction: RecordCorrection): boolean {
    return correction.name === undefined && correction.code === undefined;
  }

  private static correctionOf({
    before,
    after,
  }: EditOfRecordInUse): RecordCorrection {
    return {
      ...(after.name === before.name ? {} : { name: after.name }),
      ...(after.code === undefined || after.code === before.code
        ? {}
        : { code: after.code }),
    };
  }

  private static add(
    namesByKind: Map<DependentKind, (string | null)[]>,
    dependent: DependentRecord,
  ): void {
    const names = namesByKind.get(dependent.kind) ?? [];
    names.push(dependent.name);
    namesByKind.set(dependent.kind, names);
  }
}
