import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { BomReview } from '@boms/domain/value/bom-review.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import {
  PendingReviewChanges,
  ReviewChange,
} from '@boms/domain/value/pending-review-changes.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { Identity } from '@framework/domain';

import { toApprovalStatus } from './approval-status.column';
import { toReviewChanges } from './pending-review-changes.column';

// The persistence shape carries only what the domain owns, mirroring
// `ManufacturingInstructionMapper`'s comment. `createdAt`/`updatedAt` are managed entirely
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
  standardBomMiCode: string;
  brand: string;
  productName: string;
  standardLength: number;
  orderNumber: string;
  trackingNumber: string;
  description: string | null;
  registeredBy: string;
  approvalStatus: string;
  reviewedBy: string | null;
  managementNote: string | null;
  // `bom.pending_review_changes` as Prisma reads it — JSON, parsed by
  // `toReviewChanges()` on the way in.
  pendingReviewChanges: unknown;
  components: BomComponentRecord[];
}

export const BomMapper = {
  toDomain(record: BomRecord): Bom {
    return Bom.fromPersistence(
      Identity.fromString(record.id),
      Identity.fromString(record.standardBomId),
      record.standardBomMiCode,
      record.brand,
      record.productName,
      record.standardLength,
      OrderNumber.fromString(record.orderNumber),
      TrackingNumber.fromString(record.trackingNumber),
      record.description ?? undefined,
      record.registeredBy,
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
      BomReview.restore(
        toApprovalStatus(record.approvalStatus),
        record.reviewedBy,
        record.managementNote,
      ),
      PendingReviewChanges.restore(
        toReviewChanges(record.pendingReviewChanges),
      ),
    );
  },

  toPersistence(entity: Bom): BomRecord {
    return {
      id: entity.id.asString(),
      standardBomId: entity.standardBomId().asString(),
      standardBomMiCode: entity.standardBomMiCode(),
      brand: entity.brand(),
      productName: entity.productName(),
      standardLength: entity.standardLength(),
      orderNumber: entity.orderNumber().asString(),
      trackingNumber: entity.trackingNumber().asString(),
      description: entity.description() ?? null,
      registeredBy: entity.registeredBy(),
      approvalStatus: entity.approvalStatus(),
      reviewedBy: entity.reviewedBy(),
      managementNote: entity.managementNote(),
      pendingReviewChanges: [
        ...entity.pendingReviewChanges().changes(),
      ] satisfies ReviewChange[],
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
