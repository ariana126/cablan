import { BomEditRecordItem } from '@boms/application/queries/bom-edit-record.read-model';
import { ApprovalStatus } from '@boms/domain/value/approval-status';

export class BomDetailMaterialItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class BomDetailComponentItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly materials: BomDetailMaterialItem[],
  ) {}
}

// The single-BOM detail view: unlike `BomReportItem`, this carries the full
// composition, the description and `totalWeight` — the sum of every
// material's weight across every component, computed here rather than
// stored, since it is derived data with no independent existence of its own.
export class BomDetail {
  constructor(
    public readonly id: string,
    public readonly standardBomId: string,
    public readonly standardBomMiCode: string,
    public readonly brand: string,
    public readonly productName: string,
    public readonly standardLength: number,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly registeredBy: string,
    public readonly registeredAt: string,
    public readonly description: string | undefined,
    public readonly components: BomDetailComponentItem[],
    public readonly totalWeight: number,
    public readonly approvalStatus: ApprovalStatus,
    public readonly reviewedBy: string | null,
    public readonly managementNote: string | null,
    // The edit details («جزئیات ویرایش»), oldest first; `[]` when never
    // corrected. Review edits are never among them.
    public readonly editHistory: BomEditRecordItem[],
    // Whether this daily BOM may be re-sampled («نمونه گیری مجدد») — see
    // `isResamplable`. Computed on every read, never stored, since another
    // BOM's registration, edit or deletion changes it.
    public readonly resamplable: boolean,
  ) {}
}
