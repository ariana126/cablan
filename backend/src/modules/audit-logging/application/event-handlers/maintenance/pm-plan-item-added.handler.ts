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
import { PmPlanItemAdded } from '@maintenance/domain/events/pm-plan-item-added.event';

@DomainEventHandler(PmPlanItemAdded)
export class PmPlanItemAddedAuditHandler implements DomainEventHandlerOf<PmPlanItemAdded> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: PmPlanItemAdded): Promise<void> {
    await this.projector.project(
      AuditRecordType.PmPlanItem,
      event.planItemId,
      AuditAction.Registered,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
        intervalDays: event.intervalDays,
        firstDueDate: event.firstDueDate,
      }).asRegistration(),
    );
  }
}
