import { toAsciiDigits, ValueObject } from '@framework/domain';

export class Brand extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring the other
  // string-backed value objects in this codebase.
  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(brand: string): Brand {
    if (!brand.trim()) {
      throw new Error('Brand value must not be empty');
    }
    return new Brand(toAsciiDigits(brand));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
