import { Identity } from '@framework/domain';

// Always "done, now, by the signed-in user": there is no back-dating and no
// other outcome (design, stakeholder answer 5). `performedById` is the
// controller's `@CurrentUser()`.
export class RecordMaintenanceExecutionCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
    public readonly performedById: Identity,
    public readonly notes: string | undefined,
  ) {}
}
