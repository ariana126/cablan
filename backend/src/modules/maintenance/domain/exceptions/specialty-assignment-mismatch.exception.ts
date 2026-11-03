import { DomainException } from '@framework/domain';

// The System Admin's one-time completion of the activities without a
// specialty («تخصص تعیین نشده»), refused because it does not name exactly
// those activities: one is left out (`missingActivityIds`), or an entry names
// an activity that already has a specialty, is not in the catalog, or is
// named twice (`unexpectedActivityIds`). Nothing is assigned.
// A 400 `specialty-assignment-incomplete`.
export class SpecialtyAssignmentMismatch extends DomainException {
  private constructor(
    message: string,
    public readonly missingActivityIds: readonly string[],
    public readonly unexpectedActivityIds: readonly string[],
  ) {
    super(message);
  }

  public static of(
    missingActivityIds: readonly string[],
    unexpectedActivityIds: readonly string[],
  ): SpecialtyAssignmentMismatch {
    return new SpecialtyAssignmentMismatch(
      `A specialty assignment must name every activity without a specialty, and only those: ` +
        `missing [${missingActivityIds.join(', ')}], unexpected [${unexpectedActivityIds.join(', ')}]`,
      missingActivityIds,
      unexpectedActivityIds,
    );
  }
}
