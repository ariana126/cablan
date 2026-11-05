import { OrderReadModel } from '@boms/application/queries/list-orders/order.read-model';
import { OrderReadRepository } from '@boms/application/service/order-read.repository';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const MI_CODES_INCLUDE = {
  miCodes: { orderBy: { position: 'asc' } },
} as const;

type OrderWithMiCodes = Prisma.OrderGetPayload<{
  include: typeof MI_CODES_INCLUDE;
}>;

/**
 * The orders' read side, on `PrismaService` (it never runs inside a write):
 * `bom_order` with its MI codes, and each order's daily-BOM count — the
 * daily BOMs whose `order_number` is the order's — in one `groupBy`.
 */
@Injectable()
export class PrismaOrderReadRepository extends OrderReadRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(): Promise<OrderReadModel[]> {
    const orders = await this.prisma.order.findMany({
      include: MI_CODES_INCLUDE,
      orderBy: { orderNumber: 'asc' },
    });
    return this.withDailyBomCounts(orders);
  }

  async findById(id: Identity): Promise<OrderReadModel | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: id.asString() },
      include: MI_CODES_INCLUDE,
    });
    return order ? this.withDailyBomCount(order) : null;
  }

  async findByOrderNumber(
    orderNumber: OrderNumber,
  ): Promise<OrderReadModel | null> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderNumber.asString() },
      include: MI_CODES_INCLUDE,
    });
    return order ? this.withDailyBomCount(order) : null;
  }

  private async withDailyBomCount(
    order: OrderWithMiCodes,
  ): Promise<OrderReadModel> {
    const [read] = await this.withDailyBomCounts([order]);
    return read;
  }

  private async withDailyBomCounts(
    orders: OrderWithMiCodes[],
  ): Promise<OrderReadModel[]> {
    if (orders.length === 0) {
      return [];
    }
    const groups = await this.prisma.bom.groupBy({
      by: ['orderNumber'],
      where: { orderNumber: { in: orders.map((order) => order.orderNumber) } },
      _count: { _all: true },
    });
    const counts = new Map(
      groups.map((group) => [group.orderNumber, group._count._all]),
    );
    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      miCodes: order.miCodes.map((miCode) => ({
        standardBomId: miCode.standardBomId,
        miCode: miCode.miCode,
        productId: miCode.productId,
        productName: miCode.productName,
      })),
      dailyBomCount: counts.get(order.orderNumber) ?? 0,
    }));
  }
}
