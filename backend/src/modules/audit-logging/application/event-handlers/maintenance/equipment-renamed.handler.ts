import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { EquipmentRenamed } from '@maintenance/domain/events/equipment-renamed.event';

@DomainEventHandler(EquipmentRenamed)
export class EquipmentRenamedAuditHandler implements DomainEventHandlerOf<EquipmentRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: EquipmentRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
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
