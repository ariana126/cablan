import { EntityRepository, Identity } from '@framework/domain';

import { Order } from '../order.aggregate';
import { OrderNumber } from '../value/order-number.vo';

export abstract class OrderRepository extends EntityRepository<Order> {
  /** The order with this (normalised) number, if one is defined. */
  abstract findByOrderNumber(orderNumber: OrderNumber): Promise<Order | null>;

  /**
   * Loads the order, applies `change` to it and persists it as the change
   * leaves it — deleted when it was `delete()`d, saved otherwise — in one
   * transaction, serialised against every other `modify()` of the same order:
   * the load waits until a concurrent one has committed, so `change` always
   * sees the latest MI codes (a save rewrites them all). Every command that
   * changes an existing order goes through here; `change` may do further
   * writes of its own in the same transaction (a delete's daily BOMs, a
   * correction's propagation). If it throws, nothing is written.
   */
  abstract modify(
    id: Identity,
    change: (order: Order) => Promise<void>,
  ): Promise<void>;
}
