import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaintenanceActivityRenamed } from '@maintenance/domain/events/maintenance-activity-renamed.event';

@DomainEventHandler(MaintenanceActivityRenamed)
export class MaintenanceActivityRenamedAuditHandler implements DomainEventHandlerOf<MaintenanceActivityRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaintenanceActivityRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaintenanceActivity,
      event.activityId,
      AuditAction.Edited,
      [
        {
          field: 'name',
          previousValue: event.previousName,
          newValue: event.newName,
        },
      ],
    );
  }
}
