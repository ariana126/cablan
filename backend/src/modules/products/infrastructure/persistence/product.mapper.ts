import { Identity } from '@framework/domain';
import { Product } from '@products/domain/product.aggregate';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

// The persistence shape carries only what the domain owns — `id`, `name` and
// a nested composition — mirroring `ComponentMapper`'s comment. `createdAt`/
// `updatedAt` are managed entirely by the database and never flow through
// this mapper. Nested `id`s (the `product_component`/`product_material` row
// ids) are deliberately absent: the domain never tracks them, only the
// `componentId`/`materialId` of the standalone master row each line was
// built from — see `src/modules/products/CLAUDE.md`.
export interface ProductMaterialRecord {
  materialId: string;
  name: string;
}

export interface ProductComponentRecord {
  componentId: string;
  name: string;
  materials: ProductMaterialRecord[];
}

export interface ProductRecord {
  id: string;
  name: string;
  components: ProductComponentRecord[];
}

export const ProductMapper = {
  toDomain(record: ProductRecord): Product {
    return Product.fromPersistence(
      Identity.fromString(record.id),
      ProductName.fromString(record.name),
      record.components.map((component) =>
        ProductComponentLine.of(
          Identity.fromString(component.componentId),
          component.name,
          component.materials.map((material) =>
            ProductMaterialLine.of(
              Identity.fromString(material.materialId),
              material.name,
            ),
          ),
        ),
      ),
    );
  },

  toPersistence(entity: Product): ProductRecord {
    return {
      id: entity.id.asString(),
      name: entity.name().asString(),
      components: entity.components().map((component) => ({
        componentId: component.componentId().asString(),
        name: component.name(),
        materials: component.materials().map((material) => ({
          materialId: material.materialId().asString(),
          name: material.name(),
        })),
      })),
    };
  },
};
