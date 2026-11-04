import { Identity } from '@framework/domain';

/** Every execution of one PM plan row deleted (issue #110). */
export class DeleteMaintenanceExecutionsCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
  ) {}
}
