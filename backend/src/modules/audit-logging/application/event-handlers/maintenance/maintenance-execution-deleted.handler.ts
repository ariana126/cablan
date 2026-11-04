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
import { MaintenanceExecutionDeleted } from '@maintenance/domain/events/maintenance-execution-deleted.event';

// Issue #110: one row of the maintenance history deleted by the System Admin.
@DomainEventHandler(MaintenanceExecutionDeleted)
export class MaintenanceExecutionDeletedAuditHandler implements DomainEventHandlerOf<MaintenanceExecutionDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaintenanceExecutionDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaintenanceExecution,
      event.executionId,
      AuditAction.Deleted,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
        dueDate: event.dueDate,
        performedBy: event.performedByName,
      }).asDeletion(),
    );
  }
}
