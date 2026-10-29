import { DomainEvent } from '@framework/domain';

export class MaintenanceActivityRegistered implements DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly name: string,
  ) {}
}
