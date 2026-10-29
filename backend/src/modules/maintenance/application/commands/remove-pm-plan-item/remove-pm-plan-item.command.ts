import { Identity } from '@framework/domain';

export class RemovePmPlanItemCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
  ) {}
}
