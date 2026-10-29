import { DomainException } from '@framework/domain';

// A write against a PM plan item already removed from its equipment's plan:
// no interval change, no execution, no second removal. A 409
// `pm-plan-item-removed`.
export class PmPlanItemIsRemoved extends DomainException {
  private constructor(
    message: string,
    public readonly planItemId: string,
  ) {
    super(message);
  }

  public static withId(planItemId: string): PmPlanItemIsRemoved {
    return new PmPlanItemIsRemoved(
      `PM plan item ${planItemId} has been removed`,
      planItemId,
    );
  }
}
