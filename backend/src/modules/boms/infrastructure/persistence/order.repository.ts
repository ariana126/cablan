import { OrderNumberTaken } from '@boms/application/exceptions';
import { Order } from '@boms/domain/order.aggregate';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { DomainEventDispatcher } from '@framework/application';
import { Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';

export interface OrderMiCodeRecord {
  standardBomId: string;
  miCode: string;
  productId: string;
  productName: string;
}

// Only what the domain owns; the timestamps are the database's.
export interface OrderRecord {
  id: string;
  orderNumber: string;
  miCodes: OrderMiCodeRecord[];
}

// MI codes come back in assignment order, recorded as `position`.
const MI_CODES_INCLUDE = {
  miCodes: { orderBy: { position: 'asc' } },
} as const;

type OrderWithMiCodes = Prisma.OrderGetPayload<{
  include: typeof MI_CODES_INCLUDE;
}>;

function toRecord(order: OrderWithMiCodes): OrderRecord {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    miCodes: order.miCodes.map((miCode) => ({
      standardBomId: miCode.standardBomId,
      miCode: miCode.miCode,
      productId: miCode.productId,
      productName: miCode.productName,
    })),
  };
}

function toNestedCreate(miCodes: OrderMiCodeRecord[]) {
  return miCodes.map((miCode, position) => ({ ...miCode, position }));
}

export function toDomain(record: OrderRecord): Order {
  return Order.fromPersistence(
    Identity.fromString(record.id),
    OrderNumber.fromString(record.orderNumber),
    record.miCodes.map((miCode) =>
      OrderMiCode.of(
        Identity.fromString(miCode.standardBomId),
        miCode.miCode,
        Identity.fromString(miCode.productId),
        miCode.productName,
      ),
    ),
  );
}

export function toPersistence(order: Order): OrderRecord {
  return {
    id: order.id.asString(),
    orderNumber: order.orderNumber().asString(),
    miCodes: order.miCodes().map((miCode) => ({
      standardBomId: miCode.standardBomId().asString(),
      miCode: miCode.miCode(),
      productId: miCode.productId().asString(),
      productName: miCode.productName(),
    })),
  };
}

/**
 * An order spans two tables (`bom_order`, `bom_order_mi_code`), so its
 * delegate is written by hand, like `BomDelegate`: a save replaces the MI
 * codes wholesale, in the aggregate's order.
 */
class OrderDelegate implements ModelDelegate<OrderRecord> {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<OrderRecord | null> {
    const order = await this.db.order.findUnique({
      where: args.where,
      include: MI_CODES_INCLUDE,
    });
    return order ? toRecord(order) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: OrderRecord;
    update: Omit<OrderRecord, 'id'>;
  }): Promise<OrderRecord> {
    const { where, create, update } = args;
    await this.db.orderMiCode.deleteMany({ where: { orderId: where.id } });
    const saved = await this.db.order.upsert({
      where,
      create: {
        id: create.id,
        orderNumber: create.orderNumber,
        miCodes: { create: toNestedCreate(create.miCodes) },
      },
      update: {
        orderNumber: update.orderNumber,
        miCodes: { create: toNestedCreate(update.miCodes) },
      },
      include: MI_CODES_INCLUDE,
    });
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<OrderRecord> {
    // `onDelete: Cascade` removes its MI-code assignments.
    const order = await this.db.order.delete({
      where: args.where,
      include: MI_CODES_INCLUDE,
    });
    return toRecord(order);
  }
}

@Injectable()
export class PrismaOrderRepository
  extends PrismaEntityRepository<Order, OrderRecord>
  implements OrderRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  /** The unique index on `order_number` is the backstop for the handlers' check. */
  async save(entity: Order): Promise<void> {
    try {
      await super.save(entity);
    } catch (error) {
      if (isUniqueViolationOnOrderNumber(error)) {
        throw OrderNumberTaken.withOrderNumber(entity.orderNumber());
      }
      throw error;
    }
  }

  // `SELECT … FOR UPDATE` on the `bom_order` row, inside the transaction
  // `save()`/`delete()` then join (as `PrismaBomRepository.modify()`): a
  // concurrent `modify()` of the same order blocks on the lock until this
  // one commits, and only then loads — read committed, so it sees the MI
  // codes this one wrote. An unknown id locks nothing and `get()` throws
  // `EntityNotFound`.
  async modify(
    id: Identity,
    change: (order: Order) => Promise<void>,
  ): Promise<void> {
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx
        .$queryRaw`SELECT 1 FROM bom_order WHERE id = ${id.asString()} FOR UPDATE`;
      const order = await this.get(id);
      await change(order);
      await (order.isDeleted() ? this.delete(order) : this.save(order));
    });
  }

  async findByOrderNumber(orderNumber: OrderNumber): Promise<Order | null> {
    const order = await this.txHost.tx.order.findUnique({
      where: { orderNumber: orderNumber.asString() },
      include: MI_CODES_INCLUDE,
    });
    return order ? toDomain(toRecord(order)) : null;
  }

  protected delegate(): ModelDelegate<OrderRecord> {
    return new OrderDelegate(this.txHost.tx);
  }

  protected toDomain(record: OrderRecord): Order {
    return toDomain(record);
  }

  protected toPersistence(entity: Order): OrderRecord {
    return toPersistence(entity);
  }
}

// Through the `PrismaPg` driver adapter, P2002 names the columns at
// `meta.driverAdapterError.cause.constraint.fields` (as `maintenance`'s
// `isUniqueViolationOn` reads it).
function isUniqueViolationOnOrderNumber(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const meta = error.meta as
    | {
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[] } };
        };
      }
    | undefined;
  return (meta?.driverAdapterError?.cause?.constraint?.fields ?? []).some(
    (field) => field.replaceAll('"', '') === 'order_number',
  );
}
