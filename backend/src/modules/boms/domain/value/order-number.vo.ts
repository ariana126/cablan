import { ValueObject } from '@framework/domain';

// The caller-supplied work order number ("شماره سفارش") a daily BOM is
// registered/edited against. Required and non-empty: clearing it on edit
// must be rejected, not silently applied — see the "order number" rule in
// registring-bom.feature.
export class OrderNumber extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring the other
  // string-backed value objects in this codebase.
  static fromString(orderNumber: string): OrderNumber {
    if (!orderNumber.trim()) {
      throw new Error('Order number value must not be empty');
    }
    return new OrderNumber(orderNumber);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
