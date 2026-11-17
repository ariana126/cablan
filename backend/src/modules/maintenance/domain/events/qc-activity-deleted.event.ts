import { DomainEvent } from '@framework/domain';

export class QcActivityDeleted implements DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly name: string,
  ) {}
}
