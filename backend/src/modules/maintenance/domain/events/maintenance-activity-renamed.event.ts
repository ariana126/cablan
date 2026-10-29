import { DomainEvent } from '@framework/domain';

export class MaintenanceActivityRenamed implements DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly previousName: string,
    public readonly newName: string,
  ) {}
}
