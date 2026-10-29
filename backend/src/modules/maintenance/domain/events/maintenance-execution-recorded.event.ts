import { DomainEvent } from '@framework/domain';

export class MaintenanceExecutionRecorded implements DomainEvent {
  constructor(
    public readonly executionId: string,
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityName: string,
    /** ISO `YYYY-MM-DD` — the occurrence it was recorded for. */
    public readonly dueDate: string,
    public readonly performedAt: Date,
    public readonly performedByName: string,
    public readonly notes: string | null,
  ) {}
}
