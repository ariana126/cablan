// The export set's own shape ("خروجی اکسل آنالیز های استاندارد"): every
// filtered standard BOM, unpaginated, with its full composition. Deliberately
// narrower than `ManufacturingInstructionDetail` — no `id`, and no `componentId`/
// `materialId` on the composition lines, since it only becomes spreadsheet
// rows (`infrastructure/spreadsheet/standard-bom-export-grid.ts`) and never
// links back to a single standard BOM. See
// src/modules/manufacturing-instructions/CLAUDE.md and `boms/CLAUDE.md`'s own
// `BomExportItem`, which this mirrors.
export class ManufacturingInstructionExportMaterial {
  constructor(
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class ManufacturingInstructionExportComponent {
  constructor(
    public readonly name: string,
    public readonly materials: ManufacturingInstructionExportMaterial[],
  ) {}
}

export class ManufacturingInstructionExportItem {
  constructor(
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly active: boolean,
    public readonly productName: string,
    public readonly description: string | null,
    public readonly components: ManufacturingInstructionExportComponent[],
  ) {}
}

export class ManufacturingInstructionExportResult {
  constructor(public readonly items: ManufacturingInstructionExportItem[]) {}
}
