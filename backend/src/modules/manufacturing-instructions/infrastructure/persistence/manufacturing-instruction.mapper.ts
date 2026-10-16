import { Identity } from '@framework/domain';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-material-line.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import { Weight } from '@manufacturing-instructions/domain/value/weight.vo';

// The persistence shape carries only what the domain owns, mirroring
// `ProductMapper`'s comment. `createdAt`/`updatedAt` are managed entirely by
// the database and never flow through this mapper. Nested `id`s (the
// `standard_bom_component`/`standard_bom_material` row ids) are deliberately
// absent: the domain never tracks them, only the `componentId`/`materialId`
// of the standalone master row each line was cloned from — see
// `src/modules/manufacturing-instructions/CLAUDE.md`.
export interface ManufacturingInstructionMaterialRecord {
  materialId: string;
  name: string;
  weight: number;
}

export interface ManufacturingInstructionComponentRecord {
  componentId: string;
  name: string;
  materials: ManufacturingInstructionMaterialRecord[];
}

export interface ManufacturingInstructionRecord {
  id: string;
  miCode: string;
  brand: string;
  standardLength: number;
  active: boolean;
  description: string | null;
  productId: string;
  productName: string;
  components: ManufacturingInstructionComponentRecord[];
}

export const ManufacturingInstructionMapper = {
  toDomain(record: ManufacturingInstructionRecord): ManufacturingInstruction {
    return ManufacturingInstruction.fromPersistence(
      Identity.fromString(record.id),
      MiCode.fromString(record.miCode),
      Brand.fromString(record.brand),
      StandardLength.of(record.standardLength),
      record.active,
      record.description ?? undefined,
      Identity.fromString(record.productId),
      record.productName,
      record.components.map((component) =>
        ManufacturingInstructionComponentLine.of(
          Identity.fromString(component.componentId),
          component.name,
          component.materials.map((material) =>
            ManufacturingInstructionMaterialLine.of(
              Identity.fromString(material.materialId),
              material.name,
              Weight.ofGrams(material.weight),
            ),
          ),
        ),
      ),
    );
  },

  toPersistence(
    entity: ManufacturingInstruction,
  ): ManufacturingInstructionRecord {
    return {
      id: entity.id.asString(),
      miCode: entity.miCode().asString(),
      brand: entity.brand().asString(),
      standardLength: entity.standardLength().asNumber(),
      active: entity.active(),
      description: entity.description() ?? null,
      productId: entity.productId().asString(),
      productName: entity.productName(),
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
