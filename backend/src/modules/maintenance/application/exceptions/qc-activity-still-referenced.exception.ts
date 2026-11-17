import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

// The database refused deleting a QC activity: an assignment or a record
// came to reference it after the handler's dependents check (the foreign
// key restricts it). The delete handler answers it as the ordinary 409
// `record-has-dependents`; it is never mapped on its own.
export class QcActivityStillReferenced extends ApplicationException {
  private constructor(
    message: string,
    public readonly activityId: string,
  ) {
    super(message);
  }

  public static withId(id: Identity): QcActivityStillReferenced {
    return new QcActivityStillReferenced(
      `QC activity ${id.asString()} is still referenced`,
      id.asString(),
    );
  }
}
