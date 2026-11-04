import { DomainEvent } from '@framework/domain';

// Issue #110: an inactive PM plan row deleted with its executions.
export class PmPlanItemDeleted implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityName: string,
  ) {}
}
