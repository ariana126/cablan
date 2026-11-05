import {
  DependentKind,
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
 * `boms`' answer to "which of my records reference this one?" (issue #94): a
 * daily BOM references its standard BOM (`standard_bom_id`) and every material
 * and component on its composition lines, and a re-sample references the
 * daily BOM it re-samples (`resampled_from_id`). Each is named by its order
 * number. Issue #101 adds the orders: an order references every standard BOM
 * it assigns (kind `order`, named by its number), and is referenced by the
 * daily BOMs registered for it — those whose `order_number` is the order's.
 * Found by `RecordDependenciesModule` because it extends `DependentsProbe`.
 * On `txHost.tx`, like every read on the write path.
 */
@Injectable()
export class PrismaBomsDependentsProbe extends DependentsProbe {
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
        return this.dailyBomsWhere('daily-bom', {
          components: {
            some: { materials: { some: { materialId: reference.id } } },
          },
        });
      }
      case 'Component': {
        return this.dailyBomsWhere('daily-bom', {
          components: { some: { componentId: reference.id } },
        });
      }
      case 'StandardBom': {
        return [
          ...(await this.ordersAssigning(reference.id)),
          ...(await this.dailyBomsWhere('daily-bom', {
            standardBomId: reference.id,
          })),
        ];
      }
      case 'Bom': {
        return this.dailyBomsWhere('resampled-daily-bom', {
          resampledFromId: reference.id,
        });
      }
      case 'order': {
        return this.dailyBomsOfOrder(reference.id);
      }
      default: {
        return [];
      }
    }
  }

  private async ordersAssigning(
    standardBomId: string,
  ): Promise<DependentRecord[]> {
    const orders = await this.txHost.tx.order.findMany({
      where: { miCodes: { some: { standardBomId } } },
      select: { orderNumber: true },
    });
    return orders.map(({ orderNumber }) => ({
      kind: 'order',
      name: orderNumber,
    }));
  }

  // An unknown order has none (its handler has already answered the 404).
  private async dailyBomsOfOrder(orderId: string): Promise<DependentRecord[]> {
    const order = await this.txHost.tx.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    return order === null
      ? []
      : this.dailyBomsWhere('daily-bom', { orderNumber: order.orderNumber });
  }

  private async dailyBomsWhere(
    kind: DependentKind,
    where: Prisma.BomWhereInput,
  ): Promise<DependentRecord[]> {
    const boms = await this.txHost.tx.bom.findMany({
      where,
      select: { orderNumber: true },
    });
    return boms.map(({ orderNumber }) => ({ kind, name: orderNumber }));
  }
}
