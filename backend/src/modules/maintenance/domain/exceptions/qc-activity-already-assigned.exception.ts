import { DomainException } from '@framework/domain';

// A QC activity assigned to equipment it is already assigned to: one
// activity at most once per piece of equipment. A 409
// `qc-activity-already-assigned`.
export class QcActivityAlreadyAssigned extends DomainException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly activityId: string,
    public readonly activityName: string,
  ) {
    super(message);
  }

  public static of(
    equipment: { id: string; name: string },
    activity: { id: string; name: string },
  ): QcActivityAlreadyAssigned {
    return new QcActivityAlreadyAssigned(
      `QC activity ${activity.id} is already assigned to equipment ${equipment.id}`,
      equipment.id,
      equipment.name,
      activity.id,
      activity.name,
    );
  }
}
