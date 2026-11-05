import { OrderReadModel } from '@boms/application/queries/list-orders/order.read-model';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { Identity } from '@framework/domain';

/**
 * The orders' read side (issue #101): the read model straight from the
 * tables, with each order's daily-BOM count — which the aggregate does not
 * hold. A read port, so it lives here rather than in `domain/service/`.
 */
export abstract class OrderReadRepository {
  /** Every order, sorted by order number. */
  abstract list(): Promise<OrderReadModel[]>;

  abstract findById(id: Identity): Promise<OrderReadModel | null>;

  abstract findByOrderNumber(
    orderNumber: OrderNumber,
  ): Promise<OrderReadModel | null>;
}
