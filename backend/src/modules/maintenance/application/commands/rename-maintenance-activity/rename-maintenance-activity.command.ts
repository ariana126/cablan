import { Identity } from '@framework/domain';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

export class RenameMaintenanceActivityCommand {
  constructor(
    public readonly activityId: Identity,
    public readonly name: MaintenanceActivityName,
  ) {}
}
