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
 * `manufacturing-instructions`' snapshots of a product's component order
 * (issue #122): the `position` of every standard BOM's components, for each
 * standard BOM of the reordered product, matched by component id (a component
 * the product no longer has keeps its relative place after the others).
 * Materials, weights, the MI code and the active flag never move. Rewritten
 * directly, on `txHost.tx`, in the edit's transaction — no aggregate, no
 * event, no audit entry; `standard_bom_component` carries no `updated_at`.
 * Found by `RecordDependenciesModule` because it extends
 * `CompositionOrderPropagator`.
 */
@Injectable()
export class PrismaManufacturingInstructionsCompositionOrderPropagator extends CompositionOrderPropagator {
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
    const lines = await db.manufacturingInstructionComponent.findMany({
      where: { manufacturingInstruction: { productId: reference.id } },
      select: {
        id: true,
        manufacturingInstructionId: true,
        componentId: true,
        position: true,
      },
    });
    const moves = repositionedComponentLines(
      lines.map((line) => ({
        id: line.id,
        parentId: line.manufacturingInstructionId,
        componentId: line.componentId,
        position: line.position,
      })),
      orderedComponentIds,
    );
    for (const { id, position } of moves) {
      await db.manufacturingInstructionComponent.update({
        where: { id },
        data: { position },
      });
    }
  }
}
