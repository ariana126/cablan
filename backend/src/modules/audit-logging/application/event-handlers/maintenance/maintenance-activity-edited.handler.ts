import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaintenanceActivityEdited } from '@maintenance/domain/events/maintenance-activity-edited.event';

// One edit, one entry: a `name` line, a `specialty` line, or both. An edit
// that left the name alone carries the activity's name as its subject, since
// a specialty line alone would not say which activity it was.
@DomainEventHandler(MaintenanceActivityEdited)
export class MaintenanceActivityEditedAuditHandler implements DomainEventHandlerOf<MaintenanceActivityEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaintenanceActivityEdited): Promise<void> {
    const renamed = event.changes.some((change) => change.field === 'name');
    await this.projector.project(
      AuditRecordType.MaintenanceActivity,
      event.activityId,
      AuditAction.Edited,
      event.changes,
      renamed ? null : { field: 'name', value: event.activityName },
    );
  }
}
