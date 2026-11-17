import { Identity } from '@framework/domain';

export class AssignQcActivityCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly activityId: Identity,
  ) {}
}
