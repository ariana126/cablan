import { DomainException } from '@framework/domain';

/** What was attempted with an activity the equipment does not have. */
export type QcActivityNotAssignedAttempt = 'unassign' | 'record';

// A QC activity named for equipment it is not assigned to — never, or no
// longer. One problem type, `qc-activity-not-assigned`, whose status follows
// the attempt: unassigning it is a 404 (there is no such assignment),
// recording it a 409 (the activity exists, the equipment does not take it),
// with the detail naming both.
export class QcActivityNotAssigned extends DomainException {
  private constructor(
    message: string,
    public readonly attempt: QcActivityNotAssignedAttempt,
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly activityId: string,
    public readonly activityName: string,
  ) {
    super(message);
  }

  public static toUnassign(
    equipment: { id: string; name: string },
    activity: { id: string; name: string },
  ): QcActivityNotAssigned {
    return QcActivityNotAssigned.of('unassign', equipment, activity);
  }

  public static toRecord(
    equipment: { id: string; name: string },
    activity: { id: string; name: string },
  ): QcActivityNotAssigned {
    return QcActivityNotAssigned.of('record', equipment, activity);
  }

  private static of(
    attempt: QcActivityNotAssignedAttempt,
    equipment: { id: string; name: string },
    activity: { id: string; name: string },
  ): QcActivityNotAssigned {
    return new QcActivityNotAssigned(
      `QC activity ${activity.id} is not assigned to equipment ${equipment.id}`,
      attempt,
      equipment.id,
      equipment.name,
      activity.id,
      activity.name,
    );
  }
}
