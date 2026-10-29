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
import { PmPlanItemRemoved } from '@maintenance/domain/events/pm-plan-item-removed.event';

@DomainEventHandler(PmPlanItemRemoved)
export class PmPlanItemRemovedAuditHandler implements DomainEventHandlerOf<PmPlanItemRemoved> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: PmPlanItemRemoved): Promise<void> {
    await this.projector.project(
      AuditRecordType.PmPlanItem,
      event.planItemId,
      AuditAction.Deleted,
      AuditSnapshot.of({
        equipment: event.equipmentName,
        activity: event.activityName,
      }).asDeletion(),
    );
  }
}
