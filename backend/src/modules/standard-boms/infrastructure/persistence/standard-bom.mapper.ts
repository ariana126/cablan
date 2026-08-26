import { Identity } from '@framework/domain';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

// The persistence shape carries only what the domain owns, mirroring
// `ProductMapper`'s comment. `createdAt`/`updatedAt` are managed entirely by
// the database and never flow through this mapper. Nested `id`s (the
// `standard_bom_component`/`standard_bom_material` row ids) are deliberately
// absent: the domain never tracks them, only the `componentId`/`materialId`
// of the standalone master row each line was cloned from — see
// `src/modules/standard-boms/CLAUDE.md`.
export interface StandardBomMaterialRecord {
  materialId: string;
  name: string;
  weight: number;
}

export interface StandardBomComponentRecord {
  componentId: string;
  name: string;
  materials: StandardBomMaterialRecord[];
}

export interface StandardBomRecord {
  id: string;
  miCode: string;
  brand: string;
  standardLength: number;
  active: boolean;
  description: string | null;
  productId: string;
  components: StandardBomComponentRecord[];
}

export const StandardBomMapper = {
  toDomain(record: StandardBomRecord): StandardBom {
    return StandardBom.fromPersistence(
      Identity.fromString(record.id),
      MiCode.fromString(record.miCode),
      Brand.fromString(record.brand),
      StandardLength.of(record.standardLength),
      record.active,
      record.description ?? undefined,
      Identity.fromString(record.productId),
      record.components.map((component) =>
        StandardBomComponentLine.of(
          Identity.fromString(component.componentId),
          component.name,
          component.materials.map((material) =>
            StandardBomMaterialLine.of(
              Identity.fromString(material.materialId),
              material.name,
              Weight.ofGrams(material.weight),
            ),
          ),
        ),
      ),
    );
  },

  toPersistence(entity: StandardBom): StandardBomRecord {
    return {
      id: entity.id.asString(),
      miCode: entity.miCode().asString(),
      brand: entity.brand().asString(),
      standardLength: entity.standardLength().asNumber(),
      active: entity.active(),
      description: entity.description() ?? null,
      productId: entity.productId().asString(),
      components: entity.components().map((component) => ({
        componentId: component.componentId().asString(),
        name: component.name(),
        materials: component.materials().map((material) => ({
          materialId: material.materialId().asString(),
          name: material.name(),
          weight: material.weight().asGrams(),
        })),
      })),
    };
  },
};
