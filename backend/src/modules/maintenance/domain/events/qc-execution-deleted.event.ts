import { DomainEvent } from '@framework/domain';

export class QcExecutionDeleted implements DomainEvent {
  constructor(
    public readonly executionId: string,
    public readonly equipmentId: string,
    /** The equipment's name when deleted, for the audit line. */
    public readonly equipmentName: string,
    public readonly activityId: string,
    /** The activity's name when deleted, for the audit line. */
    public readonly activityName: string,
    public readonly performedAt: Date,
    public readonly performedByName: string,
    public readonly trackingNumber: string,
  ) {}
}
