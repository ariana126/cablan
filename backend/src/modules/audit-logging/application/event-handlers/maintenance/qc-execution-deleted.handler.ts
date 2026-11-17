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
import { QcExecutionDeleted } from '@maintenance/domain/events/qc-execution-deleted.event';

// Issue #119: one QC record deleted by the System Admin, or with its
// retired equipment — one entry per record either way.
@DomainEventHandler(QcExecutionDeleted)
export class QcExecutionDeletedAuditHandler implements DomainEventHandlerOf<QcExecutionDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcExecutionDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.QcExecution,
      event.executionId,
      AuditAction.Deleted,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
        performedAt: event.performedAt.toISOString(),
        performedBy: event.performedByName,
        trackingNumber: event.trackingNumber,
      }).asDeletion(),
    );
  }
}
