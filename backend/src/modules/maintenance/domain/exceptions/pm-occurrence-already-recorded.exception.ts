import { DomainException } from '@framework/domain';

// A second execution for one plan item's due date — two recordings at once
// that both targeted the same occurrence. The database's unique key is what
// catches it; the repository turns that into this. A 409
// `pm-occurrence-already-recorded`.
export class PmOccurrenceAlreadyRecorded extends DomainException {
  private constructor(
    message: string,
    public readonly planItemId: string,
    public readonly dueDate: string,
  ) {
    super(message);
  }

  public static of(
    planItemId: string,
    dueDate: string,
  ): PmOccurrenceAlreadyRecorded {
    return new PmOccurrenceAlreadyRecorded(
      `The occurrence of PM plan item ${planItemId} due ${dueDate} is already recorded`,
      planItemId,
      dueDate,
    );
  }
}
