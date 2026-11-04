import { DomainException } from '@framework/domain';

// A reactivation rescheduling a row that is not an active row of the
// equipment's plan — unknown, deactivated, or named twice (issue #110). A 400
// `invalid-reactivation-item`.
export class InvalidReactivationItem extends DomainException {
  private constructor(
    message: string,
    public readonly planItemId: string,
  ) {
    super(message);
  }

  public static withId(planItemId: string): InvalidReactivationItem {
    return new InvalidReactivationItem(
      `PM plan item ${planItemId} is not an active row of this equipment's plan to reschedule once`,
      planItemId,
    );
  }
}
