import { OrderReadModel } from '@boms/application/queries/list-orders/order.read-model';
import { OrderReadRepository } from '@boms/application/service/order-read.repository';
import { EntityNotFound, Identity } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetOrderByNumberQuery } from './get-order-by-number.query';

/**
 * The order with a number, as the daily-BOM form looks it up while it is
 * typed. An unknown number is the usual 404, naming the (normalised) number
 * as its `entityId`.
 */
@QueryHandler(GetOrderByNumberQuery)
export class GetOrderByNumberHandler implements IQueryHandler<GetOrderByNumberQuery> {
  constructor(private readonly orderReadRepository: OrderReadRepository) {}

  async execute(query: GetOrderByNumberQuery): Promise<OrderReadModel> {
    const order = await this.orderReadRepository.findByOrderNumber(
      query.orderNumber,
    );
    if (order === null) {
      throw EntityNotFound.withId(
        Identity.fromString(query.orderNumber.asString()),
      );
    }
    return order;
  }
}
