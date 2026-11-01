import { Identity } from '@framework/domain';

export class DeactivatePmPlanItemCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
  ) {}
}
