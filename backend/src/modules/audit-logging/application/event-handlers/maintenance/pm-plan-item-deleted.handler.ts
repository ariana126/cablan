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
import { PmPlanItemDeleted } from '@maintenance/domain/events/pm-plan-item-deleted.event';

// Issue #110: an inactive row deleted for good, with its executions.
@DomainEventHandler(PmPlanItemDeleted)
export class PmPlanItemDeletedAuditHandler implements DomainEventHandlerOf<PmPlanItemDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: PmPlanItemDeleted): Promise<void> {
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
