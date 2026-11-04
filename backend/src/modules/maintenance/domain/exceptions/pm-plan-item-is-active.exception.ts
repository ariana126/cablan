import { DomainException } from '@framework/domain';

// Deleting a PM plan row that is still active: a row is deactivated before it
// can be deleted (issue #110). A 409 `pm-plan-item-active`.
export class PmPlanItemIsActive extends DomainException {
  private constructor(
    message: string,
    public readonly planItemId: string,
  ) {
    super(message);
  }

  public static withId(planItemId: string): PmPlanItemIsActive {
    return new PmPlanItemIsActive(
      `PM plan item ${planItemId} is active; deactivate it before deleting it`,
      planItemId,
    );
  }
}
