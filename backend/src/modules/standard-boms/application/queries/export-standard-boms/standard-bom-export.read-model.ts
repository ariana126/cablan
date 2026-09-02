// The export set's own shape ("خروجی اکسل آنالیز های استاندارد"): every
// filtered standard BOM, unpaginated, with its full composition. Deliberately
// narrower than `StandardBomDetail` — no `id`, and no `componentId`/
// `materialId` on the composition lines, since the frontend only turns this
// into spreadsheet rows and never links back to a single standard BOM. See
// src/modules/standard-boms/CLAUDE.md and `boms/CLAUDE.md`'s own
// `BomExportItem`, which this mirrors.
export class StandardBomExportMaterial {
  constructor(
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class StandardBomExportComponent {
  constructor(
    public readonly name: string,
    public readonly materials: StandardBomExportMaterial[],
  ) {}
}

export class StandardBomExportItem {
  constructor(
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly active: boolean,
    public readonly productName: string,
    public readonly description: string | null,
    public readonly components: StandardBomExportComponent[],
  ) {}
}

export class StandardBomExportResult {
  constructor(public readonly items: StandardBomExportItem[]) {}
}
