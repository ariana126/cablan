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
import { MaintenanceExecutionRecorded } from '@maintenance/domain/events/maintenance-execution-recorded.event';

@DomainEventHandler(MaintenanceExecutionRecorded)
export class MaintenanceExecutionRecordedAuditHandler implements DomainEventHandlerOf<MaintenanceExecutionRecorded> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaintenanceExecutionRecorded): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaintenanceExecution,
      event.executionId,
      AuditAction.Registered,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
        dueDate: event.dueDate,
        performedAt: event.performedAt.toISOString(),
        performedBy: event.performedByName,
        notes: event.notes,
      }).asRegistration(),
    );
  }
}
