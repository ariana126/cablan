import { DomainException } from '@framework/domain';

// A write against a PM plan item already deactivated in its equipment's plan:
// no interval change, no execution, no second deactivation — and no
// reactivation, which nothing offers. A 409 `pm-plan-item-deactivated`.
export class PmPlanItemIsDeactivated extends DomainException {
  private constructor(
    message: string,
    public readonly planItemId: string,
  ) {
    super(message);
  }

  public static withId(planItemId: string): PmPlanItemIsDeactivated {
    return new PmPlanItemIsDeactivated(
      `PM plan item ${planItemId} has been deactivated`,
      planItemId,
    );
  }
}
