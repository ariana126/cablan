import { OrderNumberTaken } from '@boms/application/exceptions';
import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { Order } from '@boms/domain/order.aggregate';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DefineOrderCommand } from './define-order.command';

/** Defines an order («تعریف سفارش»); answers its id. */
@CommandHandler(DefineOrderCommand)
export class DefineOrderHandler implements ICommandHandler<
  DefineOrderCommand,
  string
> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly standardBomLookup: StandardBomLookup,
  ) {}

  async execute(command: DefineOrderCommand): Promise<string> {
    // The unique index on `order_number` is the backstop for this check.
    if (await this.orderRepository.findByOrderNumber(command.orderNumber)) {
      throw OrderNumberTaken.withOrderNumber(command.orderNumber);
    }
    const miCodes = await this.standardBomLookup.assignable(command.miCodes);
    const order = Order.define(command.orderNumber, miCodes);
    await this.orderRepository.save(order);
    return order.id.asString();
  }
}
