import { DomainException } from '@framework/domain';

// Completing a missing specialty aimed at an activity that already has one.
// The completion only ever fills in a specialty that is missing; changing
// one is the ordinary edit, guarded by the PM-plan lock. `MissingSpecialties`
// refuses such a request first, as `SpecialtyAssignmentMismatch`, so this is
// the aggregate's own backstop.
export class ActivityAlreadyHasSpecialty extends DomainException {
  private constructor(
    message: string,
    public readonly activityId: string,
  ) {
    super(message);
  }

  public static forActivity(activityId: string): ActivityAlreadyHasSpecialty {
    return new ActivityAlreadyHasSpecialty(
      `Maintenance activity ${activityId} already has a specialty`,
      activityId,
    );
  }
}
