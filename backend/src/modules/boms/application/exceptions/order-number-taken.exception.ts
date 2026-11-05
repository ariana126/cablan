import { ApplicationException } from '@framework/application';

import { OrderNumber } from '../../domain/value/order-number.vo';

// Another order already has this number (Persian digits read as English
// ones): defining an order with it, or renumbering one to it, changes
// nothing.
export class OrderNumberTaken extends ApplicationException {
  private constructor(
    message: string,
    public readonly orderNumber: string,
  ) {
    super(message);
  }

  public static withOrderNumber(orderNumber: OrderNumber): OrderNumberTaken {
    return new OrderNumberTaken(
      `An order with number ${orderNumber.asString()} already exists`,
      orderNumber.asString(),
    );
  }
}
