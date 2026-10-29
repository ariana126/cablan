import { Identity } from '@framework/domain';

export class ChangePmPlanItemIntervalCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
    public readonly intervalDays: number,
  ) {}
}
