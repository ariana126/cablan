import { Identity } from '@framework/domain';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';

export type QcActivityRecordingOutcome = 'recorded' | 'refused';

/**
 * Why one activity of a submission was refused — the problem type the
 * single-activity route answers the same refusal with, as issue #132's
 * contract pinned it.
 */
export type QcActivityRecordingRefusal =
  | 'qc-activity-not-assigned'
  | 'qc-activity-not-found';

/**
 * What became of one activity of a submission: `recorded`, with its record
 * (made now, or by an earlier sending of the same submission), or `refused`,
 * with why. `activityName` is the activity's current name, `null` when no
 * activity has its id.
 */
export class QcActivityRecordingResult {
  private constructor(
    public readonly activityId: string,
    public readonly activityName: string | null,
    public readonly outcome: QcActivityRecordingOutcome,
    public readonly executionId: string | null,
    public readonly problemType: QcActivityRecordingRefusal | null,
  ) {}

  public static recorded(
    activity: QcActivity,
    executionId: Identity,
  ): QcActivityRecordingResult {
    return new QcActivityRecordingResult(
      activity.id.asString(),
      activity.name().asString(),
      'recorded',
      executionId.asString(),
      null,
    );
  }

  public static notAssigned(activity: QcActivity): QcActivityRecordingResult {
    return new QcActivityRecordingResult(
      activity.id.asString(),
      activity.name().asString(),
      'refused',
      null,
      'qc-activity-not-assigned',
    );
  }

  public static activityNotFound(
    activityId: Identity,
  ): QcActivityRecordingResult {
    return new QcActivityRecordingResult(
      activityId.asString(),
      null,
      'refused',
      null,
      'qc-activity-not-found',
    );
  }
}

/** A submission's outcome, one result per activity in the order submitted. */
export interface QcExecutionsRecording {
  readonly results: readonly QcActivityRecordingResult[];
}
