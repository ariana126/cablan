import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { PmPlanItemIntervalChanged } from '@maintenance/domain/events/pm-plan-item-interval-changed.event';

// The interval is what changed; which equipment's which activity it was is
// the subject a reader identifies the plan item by.
@DomainEventHandler(PmPlanItemIntervalChanged)
export class PmPlanItemIntervalChangedAuditHandler implements DomainEventHandlerOf<PmPlanItemIntervalChanged> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: PmPlanItemIntervalChanged): Promise<void> {
    await this.projector.project(
      AuditRecordType.PmPlanItem,
      event.planItemId,
      AuditAction.Edited,
      [
        {
          field: 'intervalDays',
          previousValue: String(event.previousIntervalDays),
          newValue: String(event.newIntervalDays),
        },
      ],
      {
        field: 'pmPlanItem',
        value: `${event.equipmentName}: ${event.activityName}`,
      },
    );
  }
}
