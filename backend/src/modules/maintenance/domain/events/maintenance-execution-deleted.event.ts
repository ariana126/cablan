import { DomainEvent } from '@framework/domain';

// Issue #110: one row of the maintenance history deleted by the System Admin.
// Carries its snapshots as they stood, for the audit entry.
export class MaintenanceExecutionDeleted implements DomainEvent {
  constructor(
    public readonly executionId: string,
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityName: string,
    /** ISO `YYYY-MM-DD` — the occurrence it had been recorded for. */
    public readonly dueDate: string,
    public readonly performedByName: string,
  ) {}
}
