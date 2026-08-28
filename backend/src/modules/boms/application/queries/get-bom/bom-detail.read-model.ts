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
  ) {}
}
