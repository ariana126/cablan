import { ApplicationException } from '@framework/application';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

// Defining or renaming a QC activity to a name already in the QC catalog. A
// 409 `qc-activity-name-taken`.
export class QcActivityNameTaken extends ApplicationException {
  private constructor(
    message: string,
    public readonly activityName: QcActivityName,
  ) {
    super(message);
  }

  public static withName(name: QcActivityName): QcActivityNameTaken {
    return new QcActivityNameTaken(
      `A QC activity already exists with name ${name.asString()}`,
      name,
    );
  }
}
