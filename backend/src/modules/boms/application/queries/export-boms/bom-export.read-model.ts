// The export set's own shape ("خروجی اکسل آنالیز های روزانه"): every
// filtered daily BOM, unpaginated, with its full composition. Deliberately
// narrower than `BomDetail` — no `id`/`standardBomId`, since the frontend
// only turns this into spreadsheet rows and never links back to a single
// BOM. See src/modules/boms/CLAUDE.md.
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
    public readonly components: BomExportComponent[],
  ) {}
}

export class BomExportResult {
  constructor(public readonly items: BomExportItem[]) {}
}
