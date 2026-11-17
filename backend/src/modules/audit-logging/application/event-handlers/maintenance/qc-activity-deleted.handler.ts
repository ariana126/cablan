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
import { QcActivityDeleted } from '@maintenance/domain/events/qc-activity-deleted.event';

// Issue #119: an unused QC activity deleted from the catalog.
@DomainEventHandler(QcActivityDeleted)
export class QcActivityDeletedAuditHandler implements DomainEventHandlerOf<QcActivityDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcActivityDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.QcActivity,
      event.activityId,
      AuditAction.Deleted,
      AuditSnapshot.of({ name: event.name }).asDeletion(),
    );
  }
}
