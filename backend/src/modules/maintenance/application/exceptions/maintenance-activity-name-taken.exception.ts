import { ApplicationException } from '@framework/application';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

// Registering or renaming an activity to a name already in the catalog. A 409
// `maintenance-activity-name-taken`.
export class MaintenanceActivityNameTaken extends ApplicationException {
  private constructor(
    message: string,
    public readonly activityName: MaintenanceActivityName,
  ) {
    super(message);
  }

  public static withName(
    name: MaintenanceActivityName,
  ): MaintenanceActivityNameTaken {
    return new MaintenanceActivityNameTaken(
      `A maintenance activity already exists with name ${name.asString()}`,
      name,
    );
  }
}
