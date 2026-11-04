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
import { EquipmentReactivated } from '@maintenance/domain/events/equipment-reactivated.event';

// Issue #110: reads like a registration — the equipment back in service —
// then one `firstDueDate:<activity>` line per row given a new first due date
// (`''` → ISO date); a row continuing its calendar has none.
@DomainEventHandler(EquipmentReactivated)
export class EquipmentReactivatedAuditHandler implements DomainEventHandlerOf<EquipmentReactivated> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: EquipmentReactivated): Promise<void> {
    await this.projector.project(
      AuditRecordType.Equipment,
      event.equipmentId,
      AuditAction.Reactivated,
      [
        ...AuditSnapshot.of({ name: event.name }).asRegistration(),
        ...event.rescheduledItems.map((item) => ({
          field: `firstDueDate:${item.activityName}`,
          previousValue: '',
          newValue: item.firstDueDate,
        })),
      ],
    );
  }
}
