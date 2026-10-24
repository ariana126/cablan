import { toAsciiDigits, ValueObject } from '@framework/domain';

export class MaterialName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring Username:
  // material names are compared case-sensitively, so "Steel Rod" and
  // "steel rod" must count as different materials.
  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(name: string): MaterialName {
    if (!name.trim()) {
      throw new Error('Material name value must not be empty');
    }
    return new MaterialName(toAsciiDigits(name));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
