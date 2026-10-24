import { toAsciiDigits, ValueObject } from '@framework/domain';

export class ProductName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring ComponentName
  // and MaterialName: product names are compared case-sensitively.
  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(name: string): ProductName {
    if (!name.trim()) {
      throw new Error('Product name value must not be empty');
    }
    return new ProductName(toAsciiDigits(name));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
