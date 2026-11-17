import { DomainEvent } from '@framework/domain';

export class QcExecutionRecorded implements DomainEvent {
  constructor(
    public readonly executionId: string,
    public readonly equipmentId: string,
    /** The equipment's name when recorded, for the audit line. */
    public readonly equipmentName: string,
    public readonly activityId: string,
    /** The activity's name when recorded, for the audit line. */
    public readonly activityName: string,
    public readonly performedAt: Date,
    public readonly performedByName: string,
    public readonly trackingNumber: string,
    public readonly notes: string | null,
  ) {}
}
