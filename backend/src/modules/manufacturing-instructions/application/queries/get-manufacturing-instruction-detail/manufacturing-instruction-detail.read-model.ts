// Mirrors `BomDetail` in `boms/`: the full detail shape for the standard BOM
// report's "مشاهده جزئیات" dialog, including composition and total weight.
// Deliberately does not include MI code on the component lines (unlike the
// product-level composition that ManufacturingInstruction was cloned from): by the time a
// Standard BOM is registered, its component lines carry the names the caller
// supplied, not the id/name of the standalone Component row each was cloned
// from — see `ManufacturingInstructionCompositionFactory` and `src/modules/manufacturing-instructions/CLAUDE.md`.
export class ManufacturingInstructionDetailMaterialItem {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class ManufacturingInstructionDetailComponentItem {
  constructor(
    public readonly componentId: string,
    public readonly name: string,
    public readonly materials: ManufacturingInstructionDetailMaterialItem[],
  ) {}
}

export class ManufacturingInstructionDetail {
  constructor(
    public readonly id: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly productName: string,
    public readonly standardLength: number,
    public readonly active: boolean,
    public readonly description: string | null,
    public readonly components: ManufacturingInstructionDetailComponentItem[],
    public readonly totalWeight: number,
  ) {}
}
