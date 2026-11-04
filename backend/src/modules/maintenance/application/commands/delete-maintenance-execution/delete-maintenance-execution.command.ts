import { Identity } from '@framework/domain';

/** One row of an equipment's maintenance history deleted (issue #110). */
export class DeleteMaintenanceExecutionCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
    public readonly executionId: Identity,
  ) {}
}
