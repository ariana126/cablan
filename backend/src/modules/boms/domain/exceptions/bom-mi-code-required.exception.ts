import { DomainException } from '@framework/domain';

import { OrderNumber } from '../value/order-number.vo';

// A daily BOM registered with no MI code for an order holding several
// (issue #101): only an order with exactly one MI code chooses it itself.
// Thrown by `Order.miCodeForDailyBom()`.
export class BomMiCodeRequired extends DomainException {
  private constructor(
    message: string,
    public readonly orderNumber: string,
  ) {
    super(message);
  }

  public static forOrder(orderNumber: OrderNumber): BomMiCodeRequired {
    return new BomMiCodeRequired(
      `Order ${orderNumber.asString()} has several MI codes; choose one`,
      orderNumber.asString(),
    );
  }
}
