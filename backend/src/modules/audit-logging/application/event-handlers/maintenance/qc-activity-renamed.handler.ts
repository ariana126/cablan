import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { QcActivityRenamed } from '@maintenance/domain/events/qc-activity-renamed.event';

// Issue #119: a QC activity renamed — the System Admin's correction of one
// in use included.
@DomainEventHandler(QcActivityRenamed)
export class QcActivityRenamedAuditHandler implements DomainEventHandlerOf<QcActivityRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcActivityRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.QcActivity,
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
