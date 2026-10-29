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
import { EquipmentRetired } from '@maintenance/domain/events/equipment-retired.event';

// Reads like a deletion — the equipment as it stood, leaving service — under
// its own action, since the record itself is kept.
@DomainEventHandler(EquipmentRetired)
export class EquipmentRetiredAuditHandler implements DomainEventHandlerOf<EquipmentRetired> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: EquipmentRetired): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
      AuditAction.Retired,
      AuditSnapshot.of({ name: event.name }).asDeletion(),
    );
  }
}
