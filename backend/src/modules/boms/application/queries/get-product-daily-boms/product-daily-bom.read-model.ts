import { ApprovalStatus } from '@boms/domain/value/approval-status';

// One line of one daily BOM's composition on the dashboard's per-product
// detail view: the cloned (component, material) pair from the daily BOM,
// alongside the actual weight recorded on that daily BOM and the
// corresponding weight on the referenced standard BOM at the moment the
// dashboard rendered. `difference` is the absolute deviation
// `|actualWeight - standardWeight|` (above and below standard count alike),
// and the score is Σ difference across the BOM's lines.
//
// `componentId`/`materialId` are the cloned ids — what an inline weight edit
// sends back through `PATCH /boms/:id` to rebuild the full composition.
export class ProductDailyBomLine {
  constructor(
    public readonly componentId: string,
    public readonly componentName: string,
    public readonly materialId: string,
    public readonly materialName: string,
    public readonly actualWeight: number,
    public readonly standardWeight: number,
    public readonly difference: number,
  ) {}
}

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
    public readonly lines: ProductDailyBomLine[],
  ) {}
}
