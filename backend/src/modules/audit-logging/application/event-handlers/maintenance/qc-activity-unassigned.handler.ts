import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { QcActivityUnassigned } from '@maintenance/domain/events/qc-activity-unassigned.event';

// Issue #119: the equipment's edit removing a `qcActivity` line.
@DomainEventHandler(QcActivityUnassigned)
export class QcActivityUnassignedAuditHandler implements DomainEventHandlerOf<QcActivityUnassigned> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: QcActivityUnassigned): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
      AuditAction.Edited,
      [
        {
          field: 'qcActivity',
          previousValue: event.activityName,
          newValue: '',
        },
      ],
      { field: 'name', value: event.equipmentName },
    );
  }
}
