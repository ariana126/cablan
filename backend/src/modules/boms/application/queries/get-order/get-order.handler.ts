import { OrderReadModel } from '@boms/application/queries/list-orders/order.read-model';
import { OrderReadRepository } from '@boms/application/service/order-read.repository';
import { EntityNotFound } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetOrderQuery } from './get-order.query';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery> {
  constructor(private readonly orderReadRepository: OrderReadRepository) {}

  async execute(query: GetOrderQuery): Promise<OrderReadModel> {
    const order = await this.orderReadRepository.findById(query.orderId);
    if (order === null) {
      throw EntityNotFound.withId(query.orderId);
    }
    return order;
  }
}
