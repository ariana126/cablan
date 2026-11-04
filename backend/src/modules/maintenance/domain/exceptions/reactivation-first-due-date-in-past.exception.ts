import { DomainException } from '@framework/domain';

// A reactivation giving a row a new first due date before the reactivation
// day (Tehran) — today itself is allowed (issue #110). A 400
// `reactivation-first-due-date-in-past`.
export class ReactivationFirstDueDateInPast extends DomainException {
  private constructor(
    message: string,
    public readonly planItemId: string,
    /** ISO `YYYY-MM-DD`. */
    public readonly firstDueDate: string,
  ) {
    super(message);
  }

  public static of(
    planItemId: string,
    firstDueDate: string,
    reactivatedOn: string,
  ): ReactivationFirstDueDateInPast {
    return new ReactivationFirstDueDateInPast(
      `PM plan item ${planItemId} cannot first fall due on ${firstDueDate}, before its reactivation on ${reactivatedOn}`,
      planItemId,
      firstDueDate,
    );
  }
}
