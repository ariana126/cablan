import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

export class RegisterMaintenanceActivityCommand {
  constructor(
    public readonly name: MaintenanceActivityName,
    public readonly specialty: ActivitySpecialty,
  ) {}
}
