import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaintenanceActivityRegistered } from '@maintenance/domain/events/maintenance-activity-registered.event';

@DomainEventHandler(MaintenanceActivityRegistered)
export class MaintenanceActivityRegisteredAuditHandler implements DomainEventHandlerOf<MaintenanceActivityRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaintenanceActivityRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaintenanceActivity,
      event.activityId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name }).asRegistration(),
    );
  }
}
