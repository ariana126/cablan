import { Identity } from '@framework/domain';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';

// Always "done, now, by the signed-in user": `performedById` is the
// controller's `@CurrentUser()` and the time the clock's, never the body's.
// The tracking number is required; notes are optional.
export class RecordQcExecutionCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly activityId: Identity,
    public readonly performedById: Identity,
    public readonly trackingNumber: QcTrackingNumber,
    public readonly notes: string | undefined,
  ) {}
}
