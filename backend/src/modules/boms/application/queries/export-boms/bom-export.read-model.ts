import { ApprovalStatus } from '@boms/domain/value/approval-status';

// The export set's own shape ("خروجی اکسل آنالیز های روزانه"): every
// filtered daily BOM, unpaginated, with its full composition. Deliberately
// narrower than `BomDetail` — no `id`/`standardBomId`, since it only becomes
// spreadsheet rows (`infrastructure/spreadsheet/bom-export-grid.ts`) and never
// links back to a single BOM. See src/modules/boms/CLAUDE.md.
export class BomExportMaterial {
  constructor(
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class BomExportComponent {
  constructor(
    public readonly name: string,
    public readonly materials: BomExportMaterial[],
  ) {}
}

export class BomExportItem {
  constructor(
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly registeredAt: string,
    public readonly registeredBy: string,
    public readonly standardBomMiCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly productName: string,
    public readonly description: string | null,
    public readonly approvalStatus: ApprovalStatus,
    public readonly reviewedBy: string | null,
    public readonly managementNote: string | null,
    /** Σ every material weight, across components: what one metre weighs. */
    public readonly weightPerMeter: number,
    /** `weightPerMeter` × `standardLength`. */
    public readonly standardLengthWeight: number,
    /** `standardLengthWeight` minus the standard BOM's current total × `standardLength` — positive
     * when heavier, negative when lighter; null when the standard BOM can no longer be found. */
    public readonly differenceFromStandard: number | null,
    public readonly components: BomExportComponent[],
  ) {}
}

export class BomExportResult {
  constructor(public readonly items: BomExportItem[]) {}
}
