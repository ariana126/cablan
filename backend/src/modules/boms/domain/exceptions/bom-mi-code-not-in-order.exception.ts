import { DomainException } from '@framework/domain';

import { OrderNumber } from '../value/order-number.vo';

// A daily BOM's MI code that its order does not assign (issue #101): on
// registration, on an edit of its MI code — which must also stay with the
// same product — or on an edit of its order number to an order without it.
// Thrown by the `Order`'s daily-BOM rules.
export class BomMiCodeNotInOrder extends DomainException {
  private constructor(
    message: string,
    public readonly orderNumber: string,
    public readonly standardBomMiCode: string,
  ) {
    super(message);
  }

  public static of(
    standardBomMiCode: string,
    orderNumber: OrderNumber,
  ): BomMiCodeNotInOrder {
    return new BomMiCodeNotInOrder(
      `MI code ${standardBomMiCode} is not one of order ${orderNumber.asString()}'s MI codes of the daily BOM's product`,
      orderNumber.asString(),
      standardBomMiCode,
    );
  }
}
