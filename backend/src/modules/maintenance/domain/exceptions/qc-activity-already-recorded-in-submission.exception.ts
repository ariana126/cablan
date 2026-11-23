import { DomainException } from '@framework/domain';

// A second record of one activity in one submission (issue #132): the same
// «ثبت انجام» sent again while its first sending was still being saved. The
// database's unique key on (submission, activity) is what catches it; the
// repository turns that into this. Never answered as a problem: the handler
// reports the activity recorded, with the record that got there first.
export class QcActivityAlreadyRecordedInSubmission extends DomainException {
  private constructor(
    message: string,
    public readonly submissionId: string,
    public readonly activityId: string,
  ) {
    super(message);
  }

  public static of(
    submissionId: string,
    activityId: string,
  ): QcActivityAlreadyRecordedInSubmission {
    return new QcActivityAlreadyRecordedInSubmission(
      `QC activity ${activityId} is already recorded in submission ${submissionId}`,
      submissionId,
      activityId,
    );
  }
}
