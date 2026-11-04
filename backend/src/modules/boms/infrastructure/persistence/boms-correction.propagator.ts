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
 * `boms`' snapshots of a corrected name (issue #110): a daily BOM's
 * `product_name`, and its composition's component and material names.
 * Nothing else of a daily BOM moves — not its weights, its review (status,
 * reviewer, note, pending review edits) or its edit history, whose stored
 * lines are history and keep the names they were written with. A reviewed
 * daily BOM is not returned to pending. Rewritten directly, on `txHost.tx`,
 * in the correction's transaction — no aggregate, no event; the product name
 * through raw SQL, so `bom.updated_at` (which a pre-#73 pending review edit is
 * dated by) keeps its value.
 *
 * A daily BOM stores its standard BOM's id, not its product's, so the product
 * is found through `standard_bom.product_id` — a read of
 * `manufacturing-instructions`' table, like the dashboard's (see this
 * module's CLAUDE.md); dependency-cruiser cannot see it. Found by
 * `RecordDependenciesModule` because it extends `CorrectionPropagator`.
 */
@Injectable()
export class PrismaBomsCorrectionPropagator extends CorrectionPropagator {
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
          UPDATE "bom" SET "product_name" = ${name}
          WHERE "standard_bom_id" IN (
            SELECT "id" FROM "standard_bom" WHERE "product_id" = ${reference.id}
          )`;
        return;
      }
      case 'Component': {
        await db.bomComponent.updateMany({
          where: { componentId: reference.id },
          data: { name },
        });
        return;
      }
      case 'Material': {
        await db.bomMaterial.updateMany({
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
