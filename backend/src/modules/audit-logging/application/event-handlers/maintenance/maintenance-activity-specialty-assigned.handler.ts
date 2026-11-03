import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaintenanceActivitySpecialtyAssigned } from '@maintenance/domain/events/maintenance-activity-specialty-assigned.event';

// The System Admin's one-time assignment, one entry per activity: an edit
// from no specialty to the one assigned.
@DomainEventHandler(MaintenanceActivitySpecialtyAssigned)
export class MaintenanceActivitySpecialtyAssignedAuditHandler implements DomainEventHandlerOf<MaintenanceActivitySpecialtyAssigned> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaintenanceActivitySpecialtyAssigned): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaintenanceActivity,
      event.activityId,
      AuditAction.Edited,
      [{ field: 'specialty', previousValue: '', newValue: event.specialty }],
      { field: 'name', value: event.activityName },
    );
  }
}
