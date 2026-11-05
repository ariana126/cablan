import { OrderReadModel } from '@boms/application/queries/list-orders/order.read-model';
import { OrderReadRepository } from '@boms/application/service/order-read.repository';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { Identity } from '@framework/domain';

// A hand-written fake answering from the read models it was seeded with. It
// does not replicate the Prisma repository's SQL (the sort, the counts):
// that is exercised against Postgres.
export class InMemoryOrderReadRepository extends OrderReadRepository {
  private readonly orders: OrderReadModel[] = [];

  seed(...orders: OrderReadModel[]): this {
    this.orders.push(...orders);
    return this;
  }

  list(): Promise<OrderReadModel[]> {
    return Promise.resolve([...this.orders]);
  }

  findById(id: Identity): Promise<OrderReadModel | null> {
    return Promise.resolve(
      this.orders.find((order) => order.id === id.asString()) ?? null,
    );
  }

  findByOrderNumber(orderNumber: OrderNumber): Promise<OrderReadModel | null> {
    return Promise.resolve(
      this.orders.find(
        (order) => order.orderNumber === orderNumber.asString(),
      ) ?? null,
    );
  }
}
