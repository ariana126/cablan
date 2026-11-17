import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

// No QC activity has this id. A 404 `qc-activity-not-found` rather than the
// generic `entity-not-found`, as issue #119's contract pinned it.
export class QcActivityNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly activityId: string,
  ) {
    super(message);
  }

  public static withId(id: Identity): QcActivityNotFound {
    return new QcActivityNotFound(
      `No QC activity has id ${id.asString()}`,
      id.asString(),
    );
  }
}
