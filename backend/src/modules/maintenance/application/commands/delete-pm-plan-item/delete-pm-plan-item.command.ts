import { Identity } from '@framework/domain';

/** An inactive PM plan row deleted with its executions (issue #110). */
export class DeletePmPlanItemCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
  ) {}
}
