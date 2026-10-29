import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

export class RegisterMaintenanceActivityCommand {
  constructor(public readonly name: MaintenanceActivityName) {}
}
