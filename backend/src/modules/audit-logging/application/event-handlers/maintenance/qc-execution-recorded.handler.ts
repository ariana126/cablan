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
import { QcExecutionRecorded } from '@maintenance/domain/events/qc-execution-recorded.event';

// Issue #119: that a QC activity was done — the names as they stood then.
@DomainEventHandler(QcExecutionRecorded)
export class QcExecutionRecordedAuditHandler implements DomainEventHandlerOf<QcExecutionRecorded> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcExecutionRecorded): Promise<void> {
    await this.projector.project(
      AuditRecordType.QcExecution,
      event.executionId,
      AuditAction.Registered,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
        performedAt: event.performedAt.toISOString(),
        performedBy: event.performedByName,
        trackingNumber: event.trackingNumber,
        notes: event.notes,
      }).asRegistration(),
    );
  }
}
