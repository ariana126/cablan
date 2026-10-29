import { DomainEvent } from '@framework/domain';

export class PmPlanItemIntervalChanged implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityName: string,
    public readonly previousIntervalDays: number,
    public readonly newIntervalDays: number,
    /** ISO `YYYY-MM-DD` — the due date the new interval counts from. */
    public readonly effectiveFromDueDate: string,
  ) {}
}
