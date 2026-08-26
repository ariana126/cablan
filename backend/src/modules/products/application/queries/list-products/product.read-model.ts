import { Product } from '@products/domain/product.aggregate';

export class ProductMaterialItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}

export class ProductComponentItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly materials: ProductMaterialItem[],
  ) {}
}

// Shared by `RegisterProductHandler` (built from the just-registered
// aggregate) and `ListProductsHandler` (built from every stored aggregate) —
// one read model for both, since both hand the client the same shape.
export class ProductReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly components: ProductComponentItem[],
  ) {}

  static fromDomain(product: Product): ProductReadModel {
    return new ProductReadModel(
      product.id.asString(),
      product.name().asString(),
      product.components().map(
        (component) =>
          new ProductComponentItem(
            component.componentId().asString(),
            component.name(),
            component
              .materials()
              .map(
                (material) =>
                  new ProductMaterialItem(
                    material.materialId().asString(),
                    material.name(),
                  ),
              ),
          ),
      ),
    );
  }
}
