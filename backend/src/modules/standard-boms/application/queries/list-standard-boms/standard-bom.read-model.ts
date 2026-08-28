import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';

export class StandardBomMaterialItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly weight: number,
  ) {}
}

export class StandardBomComponentItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly materials: StandardBomMaterialItem[],
  ) {}
}

// Shared by `RegisterStandardBomHandler` (built from the just-registered
// aggregate) and `ListStandardBomsHandler` (built from every stored
// aggregate) — one read model for both, since both hand the client the same
// shape.
export class StandardBomReadModel {
  constructor(
    public readonly id: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly standardLength: number,
    public readonly active: boolean,
    public readonly description: string | undefined,
    public readonly productId: string,
    public readonly productName: string,
    public readonly components: StandardBomComponentItem[],
  ) {}

  static fromDomain(standardBom: StandardBom): StandardBomReadModel {
    return new StandardBomReadModel(
      standardBom.id.asString(),
      standardBom.miCode().asString(),
      standardBom.brand().asString(),
      standardBom.standardLength().asNumber(),
      standardBom.active(),
      standardBom.description(),
      standardBom.productId().asString(),
      standardBom.productName(),
      standardBom.components().map(
        (component) =>
          new StandardBomComponentItem(
            component.componentId().asString(),
            component.name(),
            component
              .materials()
              .map(
                (material) =>
                  new StandardBomMaterialItem(
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
