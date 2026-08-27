import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { Identity } from '@framework/domain';

// The persistence shape carries only what the domain owns, mirroring
// `StandardBomMapper`'s comment. `createdAt`/`updatedAt` are managed entirely
// by the database and never flow through this mapper. Nested `id`s (the
// `bom_component`/`bom_material` row ids) are deliberately absent: the
// domain never tracks them, only the `componentId`/`materialId` of the
// standalone master row each line was cloned from — see
// src/modules/boms/CLAUDE.md.
export interface BomMaterialRecord {
  materialId: string;
  name: string;
  weight: number;
}

export interface BomComponentRecord {
  componentId: string;
  name: string;
  materials: BomMaterialRecord[];
}

export interface BomRecord {
  id: string;
  standardBomId: string;
  orderNumber: string;
  trackingNumber: string;
  description: string | null;
  components: BomComponentRecord[];
}

export const BomMapper = {
  toDomain(record: BomRecord): Bom {
    return Bom.fromPersistence(
      Identity.fromString(record.id),
      Identity.fromString(record.standardBomId),
      OrderNumber.fromString(record.orderNumber),
      TrackingNumber.fromString(record.trackingNumber),
      record.description ?? undefined,
      record.components.map((component) =>
        BomComponentLine.of(
          Identity.fromString(component.componentId),
          component.name,
          component.materials.map((material) =>
            BomMaterialLine.of(
              Identity.fromString(material.materialId),
              material.name,
              Weight.ofGrams(material.weight),
            ),
          ),
        ),
      ),
    );
  },

  toPersistence(entity: Bom): BomRecord {
    return {
      id: entity.id.asString(),
      standardBomId: entity.standardBomId().asString(),
      orderNumber: entity.orderNumber().asString(),
      trackingNumber: entity.trackingNumber().asString(),
      description: entity.description() ?? null,
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
