import { Identity } from '@framework/domain';
import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';

// Always "done, now, by the signed-in user": there is no back-dating and no
// other outcome (design, stakeholder answer 5). `performedById` is the
// controller's `@CurrentUser()`. Notes and operating hours are optional.
export class RecordMaintenanceExecutionCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly planItemId: Identity,
    public readonly performedById: Identity,
    public readonly notes: string | undefined,
    public readonly operatingHours: OperatingHours | null,
  ) {}
}
