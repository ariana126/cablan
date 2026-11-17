import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { QcActivityAssigned } from '@maintenance/domain/events/qc-activity-assigned.event';

// Issue #119: an assignment belongs to its equipment, so it reads as an
// edit of the equipment adding a `qcActivity` line; the equipment's name is
// the subject, since that line alone would not say which equipment.
@DomainEventHandler(QcActivityAssigned)
export class QcActivityAssignedAuditHandler implements DomainEventHandlerOf<QcActivityAssigned> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcActivityAssigned): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
      AuditAction.Edited,
      [
        {
          field: 'qcActivity',
          previousValue: '',
          newValue: event.activityName,
        },
      ],
      { field: 'name', value: event.equipmentName },
    );
  }
}
