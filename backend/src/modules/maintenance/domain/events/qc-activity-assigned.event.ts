import { DomainEvent } from '@framework/domain';

export class QcActivityAssigned implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly activityId: string,
    public readonly activityName: string,
  ) {}
}
