import { ApplyToRelatedRecords } from './apply-to-related-records';
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
  ) {}

  /** Every record that references `reference`, per kind, in `DEPENDENT_KINDS` order, names sorted. */
  async dependentsOf(reference: RecordReference): Promise<RecordDependent[]> {
    const namesByKind = new Map<DependentKind, string[]>();
    for (const probe of this.probes) {
      for (const dependent of await probe.dependentsOf(reference)) {
        RecordDependencies.add(namesByKind, dependent);
      }
    }
    return DEPENDENT_KINDS.flatMap((kind) => {
      const names: string[] = namesByKind.get(kind) ?? [];
      return names.length === 0
        ? []
        : [
            {
              kind,
              count: names.length,
              names: names.toSorted((a, b) => a.localeCompare(b, 'fa')),
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
   * references the record; any other edit is held to `assertNoDependents()`
   * and writes nothing. A `write` that throws propagates nothing.
   */
  async editRecordInUse(
    reference: RecordReference,
    edit: EditOfRecordInUse,
    write: () => Promise<void>,
  ): Promise<void> {
    const correcting =
      edit.applyToRelatedRecords.isGranted() &&
      edit.changesOnlyCorrectableFields;
    if (!correcting) {
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
    if (correction.name === undefined && correction.code === undefined) {
      return;
    }
    for (const propagator of this.propagators) {
      await propagator.propagate(reference, correction, before);
    }
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
    namesByKind: Map<DependentKind, string[]>,
    dependent: DependentRecord,
  ): void {
    const names = namesByKind.get(dependent.kind) ?? [];
    names.push(dependent.name);
    namesByKind.set(dependent.kind, names);
  }
}
