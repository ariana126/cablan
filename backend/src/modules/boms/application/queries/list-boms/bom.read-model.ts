import { Bom } from '@boms/domain/bom.aggregate';

export class BomMaterialItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class BomComponentItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly materials: BomMaterialItem[],
  ) {}
}

// Shared by `RegisterBomHandler` (built from the just-registered aggregate)
// and `ListBomsHandler` (built from every stored aggregate) — one read model
// for both, since both hand the client the same shape. Mirrors
// `StandardBomReadModel`'s shape, with `standardBomId` in place of
// `productId`.
export class BomReadModel {
  constructor(
    public readonly id: string,
    public readonly standardBomId: string,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly description: string | undefined,
    public readonly components: BomComponentItem[],
  ) {}

  static fromDomain(bom: Bom): BomReadModel {
    return new BomReadModel(
      bom.id.asString(),
      bom.standardBomId().asString(),
      bom.orderNumber().asString(),
      bom.trackingNumber().asString(),
      bom.description(),
      bom.components().map(
        (component) =>
          new BomComponentItem(
            component.componentId().asString(),
            component.name(),
            component
              .materials()
              .map(
                (material) =>
                  new BomMaterialItem(
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
