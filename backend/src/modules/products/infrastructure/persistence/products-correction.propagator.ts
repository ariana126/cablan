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
 * `products`' snapshots of a corrected name (issue #110): a product's
 * composition copies of its components' and materials' names
 * (`product_component.name`, `product_material.name`). No copy of a
 * material's code is kept, so a code correction changes nothing here.
 * Rewritten directly, on `txHost.tx`, in the correction's transaction — no
 * aggregate, no event. Found by `RecordDependenciesModule` because it extends
 * `CorrectionPropagator`.
 */
@Injectable()
export class PrismaProductsCorrectionPropagator extends CorrectionPropagator {
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
      case 'Component': {
        await db.productComponent.updateMany({
          where: { componentId: reference.id },
          data: { name },
        });
        return;
      }
      case 'Material': {
        await db.productMaterial.updateMany({
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
