import { DomainEvent } from '@framework/domain';

// Carries the equipment's and the activity's names as they stood, so the audit
// entry reads without a lookup the projector could not make.
export class PmPlanItemAdded implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityId: string,
    public readonly activityName: string,
    public readonly intervalDays: number,
    /** ISO `YYYY-MM-DD`. */
    public readonly firstDueDate: string,
  ) {}
}
