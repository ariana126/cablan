import { DomainEvent } from '@framework/domain';

export class PmPlanItemRemoved implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityName: string,
  ) {}
}
