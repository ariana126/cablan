import { DependentsProbe } from './dependents-probe';
import { RecordHasDependents } from './record-has-dependents.exception';
import {
  DEPENDENT_KINDS,
  DependentKind,
  DependentRecord,
  RecordDependent,
  RecordReference,
} from './record-reference';

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
 */
export class RecordDependencies {
  constructor(private readonly probes: Iterable<DependentsProbe>) {}

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

  private static add(
    namesByKind: Map<DependentKind, string[]>,
    dependent: DependentRecord,
  ): void {
    const names = namesByKind.get(dependent.kind) ?? [];
    names.push(dependent.name);
    namesByKind.set(dependent.kind, names);
  }
}
