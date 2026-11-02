import { ApplicationException } from '../application.exception';
import { RecordDependent, RecordReference } from './record-reference';

/**
 * A record another record directly references can be neither edited nor
 * deleted (issue #94) — thrown by `RecordDependencies.assertNoDependents()`
 * and mapped once, by `FrameworkExceptionMapper`, to 409
 * `record-has-dependents` with `recordType` and `dependents`.
 */
export class RecordHasDependents extends ApplicationException {
  private constructor(
    public readonly reference: RecordReference,
    public readonly dependents: readonly RecordDependent[],
  ) {
    const referrers = dependents
      .map((dependent) => `${dependent.count} ${dependent.kind}`)
      .join(', ');
    super(
      `${reference.type} ${reference.id} cannot be edited or deleted: it is referenced by ${referrers}.`,
    );
  }

  static of(
    reference: RecordReference,
    dependents: readonly RecordDependent[],
  ): RecordHasDependents {
    return new RecordHasDependents(reference, dependents);
  }
}
