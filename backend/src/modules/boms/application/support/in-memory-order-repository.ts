import { Order } from '@boms/domain/order.aggregate';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { EntityNotFound, Identity } from '@framework/domain';

// A hand-written fake, not a mock: `OrderRepository` is an in-process
// collaborator from a handler's point of view. It keeps the events each save
// and delete released, so a spec can read what was recorded.
export class InMemoryOrderRepository extends OrderRepository {
  private readonly ordersById = new Map<string, Order>();
  public readonly releasedEvents: object[] = [];

  find(id: Identity): Promise<Order | null> {
    return Promise.resolve(this.ordersById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Order> {
    const order = await this.find(id);
    if (!order) {
      throw EntityNotFound.withId(id);
    }
    return order;
  }

  findByOrderNumber(orderNumber: OrderNumber): Promise<Order | null> {
    return Promise.resolve(
      [...this.ordersById.values()].find((order) =>
        order.orderNumber().equals(orderNumber),
      ) ?? null,
    );
  }

  save(entity: Order): Promise<void> {
    this.ordersById.set(entity.id.asString(), entity);
    this.releasedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  // No concurrency to serialise in memory: load, change, persist.
  async modify(
    id: Identity,
    change: (order: Order) => Promise<void>,
  ): Promise<void> {
    const order = await this.get(id);
    await change(order);
    if (order.isDeleted()) {
      this.ordersById.delete(order.id.asString());
    } else {
      this.ordersById.set(order.id.asString(), order);
    }
    this.releasedEvents.push(...order.releaseEvents());
  }

  list(): Order[] {
    return [...this.ordersById.values()];
  }

  seed(order: Order): Order {
    this.ordersById.set(order.id.asString(), order);
    order.releaseEvents();
    return order;
  }
}
