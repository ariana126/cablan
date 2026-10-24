import { toAsciiDigits, ValueObject } from '@framework/domain';

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
  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(orderNumber: string): OrderNumber {
    if (!orderNumber.trim()) {
      throw new Error('Order number value must not be empty');
    }
    return new OrderNumber(toAsciiDigits(orderNumber));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
