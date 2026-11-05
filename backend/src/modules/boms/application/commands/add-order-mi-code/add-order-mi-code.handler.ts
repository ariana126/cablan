import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AddOrderMiCodeCommand } from './add-order-mi-code.command';

/**
 * Assigns one more MI code to an order («افزودن کد MI»). Deliberately not
 * guarded by the order's daily BOMs (issue #94's rule does not apply): adding
 * a code changes none of them, and the approved Gherkin allows it on an order
 * in use. Through `modify()`, so two concurrent additions both land.
 */
@CommandHandler(AddOrderMiCodeCommand)
export class AddOrderMiCodeHandler implements ICommandHandler<AddOrderMiCodeCommand> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly standardBomLookup: StandardBomLookup,
  ) {}

  async execute(command: AddOrderMiCodeCommand): Promise<void> {
    // An unknown order is the 404 before the MI code is looked up.
    await this.orderRepository.get(command.orderId);
    const [miCode] = await this.standardBomLookup.assignable([command.miCode]);
    await this.orderRepository.modify(command.orderId, (order) => {
      order.addMiCode(miCode);
      return Promise.resolve();
    });
  }
}
