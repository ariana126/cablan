import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

// A submission sent again (issue #132) for another equipment, by another
// inspector or with another tracking number than its earlier records were
// made with: not the same submission, so none of it is recorded. A 409
// `qc-submission-mismatch`; the client sends it under a new submission id.
export class QcSubmissionMismatch extends ApplicationException {
  private constructor(
    message: string,
    public readonly submissionId: string,
  ) {
    super(message);
  }

  public static of(submissionId: Identity): QcSubmissionMismatch {
    return new QcSubmissionMismatch(
      `Submission ${submissionId.asString()} was recorded for another equipment, inspector or tracking number`,
      submissionId.asString(),
    );
  }
}
