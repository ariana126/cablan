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
import { PmPlanItemDeactivated } from '@maintenance/domain/events/pm-plan-item-deactivated.event';

@DomainEventHandler(PmPlanItemDeactivated)
export class PmPlanItemDeactivatedAuditHandler implements DomainEventHandlerOf<PmPlanItemDeactivated> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: PmPlanItemDeactivated): Promise<void> {
    await this.projector.project(
      AuditRecordType.PmPlanItem,
      event.planItemId,
      AuditAction.Deactivated,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
      }).asDeletion(),
    );
  }
}
