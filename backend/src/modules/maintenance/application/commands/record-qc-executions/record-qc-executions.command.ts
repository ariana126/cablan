import { Identity } from '@framework/domain';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';

/** One ticked activity of a submission, with its own notes if any. */
export interface QcActivityToRecord {
  readonly activityId: Identity;
  readonly notes: string | undefined;
}

// Several QC activities of one equipment done now, by the signed-in user,
// for one tracking number (issue #132): `performedById` is the controller's
// `@CurrentUser()` and the time the clock's, never the body's.
// `submissionId` is the client's id for this «ثبت انجام», reused when it is
// sent again. The activities come in the order ticked, each at most once
// (the DTO refuses a repeated one).
export class RecordQcExecutionsCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly performedById: Identity,
    public readonly submissionId: Identity,
    public readonly trackingNumber: QcTrackingNumber,
    public readonly activities: readonly QcActivityToRecord[],
  ) {}
}
