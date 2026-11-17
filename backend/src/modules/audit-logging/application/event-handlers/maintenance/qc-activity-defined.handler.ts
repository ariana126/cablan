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
import { QcActivityDefined } from '@maintenance/domain/events/qc-activity-defined.event';

// Issue #119: a QC activity defined in the catalog.
@DomainEventHandler(QcActivityDefined)
export class QcActivityDefinedAuditHandler implements DomainEventHandlerOf<QcActivityDefined> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcActivityDefined): Promise<void> {
    await this.projector.project(
      AuditRecordType.QcActivity,
      event.activityId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name }).asRegistration(),
    );
  }
}
