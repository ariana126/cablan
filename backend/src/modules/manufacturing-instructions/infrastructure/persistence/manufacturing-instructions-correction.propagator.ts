import {
  CorrectionPropagator,
  RecordCorrection,
  RecordReference,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * `manufacturing-instructions`' snapshots of a corrected name (issue #110): a
 * standard BOM's `product_name`, and its composition's component and material
 * names. Weights, MI codes and the active flag are never touched. Rewritten
 * directly, on `txHost.tx`, in the correction's transaction — no aggregate,
 * no event. The product name goes through raw SQL so `standard_bom.updated_at`
 * keeps its value: a correction is not an edit of the standard BOM. Found by
 * `RecordDependenciesModule` because it extends `CorrectionPropagator`.
 */
@Injectable()
export class PrismaManufacturingInstructionsCorrectionPropagator extends CorrectionPropagator {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  async propagate(
    reference: RecordReference,
    { name }: RecordCorrection,
  ): Promise<void> {
    if (name === undefined) {
      return;
    }
    const db = this.txHost.tx;
    switch (reference.type) {
      case 'Product': {
        await db.$executeRaw`
          UPDATE "standard_bom" SET "product_name" = ${name}
          WHERE "product_id" = ${reference.id}`;
        return;
      }
      case 'Component': {
        await db.manufacturingInstructionComponent.updateMany({
          where: { componentId: reference.id },
          data: { name },
        });
        return;
      }
      case 'Material': {
        await db.manufacturingInstructionMaterial.updateMany({
          where: { materialId: reference.id },
          data: { name },
        });
        return;
      }
      default: {
        return;
      }
    }
  }
}
