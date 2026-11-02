import {
  DependentRecord,
  DependentsProbe,
  RecordReference,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';

/**
 * `manufacturing-instructions`' answer to "which of my records reference this
 * one?" (issue #94): a standard BOM references its product (`product_id`) and
 * every material and component on its composition lines. Each is named by its
 * MI code. Found by `RecordDependenciesModule` because it extends
 * `DependentsProbe`. On `txHost.tx`, like every read on the write path.
 */
@Injectable()
export class PrismaManufacturingInstructionsDependentsProbe extends DependentsProbe {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  async dependentsOf(
    reference: RecordReference,
  ): Promise<readonly DependentRecord[]> {
    switch (reference.type) {
      case 'Material': {
        return this.standardBomsWhere({
          components: {
            some: { materials: { some: { materialId: reference.id } } },
          },
        });
      }
      case 'Component': {
        return this.standardBomsWhere({
          components: { some: { componentId: reference.id } },
        });
      }
      case 'Product': {
        return this.standardBomsWhere({ productId: reference.id });
      }
      default: {
        return [];
      }
    }
  }

  private async standardBomsWhere(
    where: Prisma.ManufacturingInstructionWhereInput,
  ): Promise<DependentRecord[]> {
    const standardBoms = await this.txHost.tx.manufacturingInstruction.findMany(
      { where, select: { miCode: true } },
    );
    return standardBoms.map(({ miCode }) => ({
      kind: 'standard-bom',
      name: miCode,
    }));
  }
}
