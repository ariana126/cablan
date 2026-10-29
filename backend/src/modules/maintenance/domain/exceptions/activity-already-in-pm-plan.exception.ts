import { DomainException } from '@framework/domain';

// An activity added to an equipment's plan while an active item for it is
// already there: one activity at most once per plan. A 409
// `activity-already-in-pm-plan`.
export class ActivityAlreadyInPmPlan extends DomainException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
    public readonly activityId: string,
  ) {
    super(message);
  }

  public static of(
    equipmentId: string,
    activityId: string,
  ): ActivityAlreadyInPmPlan {
    return new ActivityAlreadyInPmPlan(
      `Activity ${activityId} is already in the PM plan of equipment ${equipmentId}`,
      equipmentId,
      activityId,
    );
  }
}
