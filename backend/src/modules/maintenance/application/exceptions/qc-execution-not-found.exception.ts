import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

// No QC record has this id — never made, or deleted already. A 404
// `qc-execution-not-found`.
export class QcExecutionNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly executionId: string,
  ) {
    super(message);
  }

  public static withId(id: Identity): QcExecutionNotFound {
    return new QcExecutionNotFound(
      `No QC record has id ${id.asString()}`,
      id.asString(),
    );
  }
}
