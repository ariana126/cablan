import { DomainEvent } from '@framework/domain';

/** A row given a new first due date when its equipment was reactivated. */
export interface RescheduledPlanItemSnapshot {
  readonly planItemId: string;
  readonly activityName: string;
  /** ISO `YYYY-MM-DD`. */
  readonly firstDueDate: string;
}

// Issue #110: retired equipment back in service. The rows not listed
// continue their previous calendar.
export class EquipmentReactivated implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly name: string,
    public readonly rescheduledItems: readonly RescheduledPlanItemSnapshot[],
  ) {}
}
