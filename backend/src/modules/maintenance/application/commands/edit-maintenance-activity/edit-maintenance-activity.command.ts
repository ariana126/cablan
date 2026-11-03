import { Identity } from '@framework/domain';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

/** The general edit of a catalog activity: its name and its specialty. */
export class EditMaintenanceActivityCommand {
  constructor(
    public readonly activityId: Identity,
    public readonly name: MaintenanceActivityName,
    public readonly specialty: ActivitySpecialty,
  ) {}
}
