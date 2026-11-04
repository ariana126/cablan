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
import { EquipmentDeleted } from '@maintenance/domain/events/equipment-deleted.event';

// Issue #110: retired equipment deleted for good, with its plan and history.
@DomainEventHandler(EquipmentDeleted)
export class EquipmentDeletedAuditHandler implements DomainEventHandlerOf<EquipmentDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: EquipmentDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
      AuditAction.Deleted,
      AuditSnapshot.of({ name: event.name }).asDeletion(),
    );
  }
}
