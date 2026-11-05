import { ApplicationException } from '@framework/application';

import { OrderNumber } from '../../domain/value/order-number.vo';

// A daily BOM registered for, or edited to, an order number no order has
// (issue #101): a daily BOM is registered only for a defined order.
export class BomOrderNotDefined extends ApplicationException {
  private constructor(
    message: string,
    public readonly orderNumber: string,
  ) {
    super(message);
  }

  public static withOrderNumber(orderNumber: OrderNumber): BomOrderNotDefined {
    return new BomOrderNotDefined(
      `No order is defined with number ${orderNumber.asString()}`,
      orderNumber.asString(),
    );
  }
}
