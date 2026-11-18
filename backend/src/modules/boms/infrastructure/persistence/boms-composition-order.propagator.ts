import {
  CompositionOrderPropagator,
  RecordReference,
  repositionedComponentLines,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * `boms`' snapshots of a product's component order (issue #122): the
 * `position` of every daily BOM's components, for each daily BOM of a
 * standard BOM of the reordered product, matched by component id (a
 * component the product no longer has keeps its relative place after the
 * others). Nothing else of a daily BOM moves — not its materials, weights,
 * review or edit history — and `bom.updated_at` is untouched, since only
 * `bom_component` rows are written. Rewritten directly, on `txHost.tx`, in
 * the edit's transaction — no aggregate, no event, no audit entry.
 *
 * A daily BOM stores its standard BOM's id, not its product's, so the
 * product's daily BOMs are found through `standard_bom.product_id` — a read
 * of `manufacturing-instructions`' table, like the correction propagator's;
 * dependency-cruiser cannot see it. Found by `RecordDependenciesModule`
 * because it extends `CompositionOrderPropagator`.
 */
@Injectable()
export class PrismaBomsCompositionOrderPropagator extends CompositionOrderPropagator {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  async propagate(
    reference: RecordReference,
    orderedComponentIds: readonly string[],
  ): Promise<void> {
    if (reference.type !== 'Product') {
      return;
    }
    const db = this.txHost.tx;
    const standardBoms = await db.manufacturingInstruction.findMany({
      where: { productId: reference.id },
      select: { id: true },
    });
    const lines = await db.bomComponent.findMany({
      where: {
        bom: { standardBomId: { in: standardBoms.map(({ id }) => id) } },
      },
      select: { id: true, bomId: true, componentId: true, position: true },
    });
    const moves = repositionedComponentLines(
      lines.map((line) => ({
        id: line.id,
        parentId: line.bomId,
        componentId: line.componentId,
        position: line.position,
      })),
      orderedComponentIds,
    );
    for (const { id, position } of moves) {
      await db.bomComponent.update({ where: { id }, data: { position } });
    }
  }
}
