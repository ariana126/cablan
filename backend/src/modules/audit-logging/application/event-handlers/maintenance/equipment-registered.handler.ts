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
import { EquipmentRegistered } from '@maintenance/domain/events/equipment-registered.event';

@DomainEventHandler(EquipmentRegistered)
export class EquipmentRegisteredAuditHandler implements DomainEventHandlerOf<EquipmentRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: EquipmentRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name }).asRegistration(),
    );
  }
}
