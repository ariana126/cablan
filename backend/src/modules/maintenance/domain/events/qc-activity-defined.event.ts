import { DomainEvent } from '@framework/domain';

export class QcActivityDefined implements DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly name: string,
  ) {}
}
