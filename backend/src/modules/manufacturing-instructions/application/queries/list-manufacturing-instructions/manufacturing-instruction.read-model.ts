import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';

export class ManufacturingInstructionMaterialItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class ManufacturingInstructionComponentItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly materials: ManufacturingInstructionMaterialItem[],
  ) {}
}

// Shared by `RegisterManufacturingInstructionHandler` (built from the just-registered
// aggregate) and `ListManufacturingInstructionsHandler` (built from every stored
// aggregate) — one read model for both, since both hand the client the same
// shape.
export class ManufacturingInstructionReadModel {
  constructor(
    public readonly id: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly active: boolean,
    public readonly description: string | undefined,
    public readonly productId: string,
    public readonly productName: string,
    public readonly components: ManufacturingInstructionComponentItem[],
  ) {}

  static fromDomain(
    manufacturingInstruction: ManufacturingInstruction,
  ): ManufacturingInstructionReadModel {
    return new ManufacturingInstructionReadModel(
      manufacturingInstruction.id.asString(),
      manufacturingInstruction.miCode().asString(),
      manufacturingInstruction.brand().asString(),
      manufacturingInstruction.standardLength().asNumber(),
      manufacturingInstruction.active(),
      manufacturingInstruction.description(),
      manufacturingInstruction.productId().asString(),
      manufacturingInstruction.productName(),
      manufacturingInstruction.components().map(
        (component) =>
          new ManufacturingInstructionComponentItem(
            component.componentId().asString(),
            component.name(),
            component
              .materials()
              .map(
                (material) =>
                  new ManufacturingInstructionMaterialItem(
                    material.materialId().asString(),
                    material.name(),
                    material.weight().asGrams(),
                  ),
              ),
          ),
      ),
    );
  }
}
