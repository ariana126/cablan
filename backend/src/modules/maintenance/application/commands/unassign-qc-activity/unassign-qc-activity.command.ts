import { Identity } from '@framework/domain';

export class UnassignQcActivityCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly activityId: Identity,
  ) {}
}
