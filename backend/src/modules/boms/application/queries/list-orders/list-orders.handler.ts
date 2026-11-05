import { OrderReadRepository } from '@boms/application/service/order-read.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListOrdersQuery } from './list-orders.query';
import { OrderList } from './order.read-model';

/** Every order («سفارشات»), sorted by order number. */
@QueryHandler(ListOrdersQuery)
export class ListOrdersHandler implements IQueryHandler<ListOrdersQuery> {
  constructor(private readonly orderReadRepository: OrderReadRepository) {}

  async execute(): Promise<OrderList> {
    return { items: await this.orderReadRepository.list() };
  }
}
