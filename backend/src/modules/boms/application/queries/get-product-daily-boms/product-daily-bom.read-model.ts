import { MaterialWeightDifference } from '@boms/application/queries/material-weight-difference.read-model';
import { ApprovalStatus } from '@boms/domain/value/approval-status';

// The daily-BOM dashboard's per-product detail-row shape: one entry per
// daily BOM for the selected product in the queried range, with its
// `score` (the sum of |actualWeight - standardWeight| across every
// material line) and the per-line shape needed to render the breakdown
// table under the row.
//
// `registeredAt` is the wire string form the rest of the boms reporting
// surface uses, so the dashboard's response doesn't need any
// re-serialisation at the HTTP layer. `registeredBy` is the QC operator's
// display name, cloned onto the BOM at registration — the dashboard shows
// who registered each tracking number. `description` mirrors the
// `GetBomQuery` response — `null` from the database, `undefined` once it
// passes through the read model.
export class ProductDailyBom {
  constructor(
    public readonly id: string,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly registeredAt: string,
    public readonly registeredBy: string,
    public readonly description: string | undefined,
    // The standard BOM's MI code the daily BOM was cloned from — required
    // alongside the lines by an inline weight edit (`PATCH /boms/:id`).
    public readonly standardBomMiCode: string,
    public readonly approvalStatus: ApprovalStatus,
    public readonly approvedBy: string | null,
    public readonly score: number,
    public readonly lines: MaterialWeightDifference[],
  ) {}
}
