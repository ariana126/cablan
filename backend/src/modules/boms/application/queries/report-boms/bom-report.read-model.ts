import { ApprovalStatus } from '@boms/domain/value/approval-status';

// The report list's own shape — deliberately narrower than `BomReadModel`:
// no composition, no description, no standardLength (see
// "قانون: لیست آنالیز های روزانه شامل متراژ استاندارد، اجزا، مواد اولیه،
// توضیحات و جمع وزن مواد اولیه نیست" in reporting-bom.feature).
export class BomReportItem {
  constructor(
    public readonly id: string,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly registeredAt: string,
    public readonly registeredBy: string,
    public readonly standardBomMiCode: string,
    public readonly brand: string,
    public readonly productName: string,
    public readonly approvalStatus: ApprovalStatus,
    public readonly reviewedBy: string | null,
    public readonly managementNote: string | null,
    // Whether this daily BOM may be re-sampled («نمونه گیری مجدد») — see
    // `isResamplable`. Computed on every read, never stored, since another
    // BOM's registration, edit or deletion changes it.
    public readonly resamplable: boolean,
  ) {}
}

export class BomReportPage {
  constructor(
    public readonly items: BomReportItem[],
    public readonly total: number,
  ) {}
}
