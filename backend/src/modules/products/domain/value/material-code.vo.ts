import { toAsciiDigits, ValueObject } from '@framework/domain';

// A material's required code — e.g. a supplier or warehouse reference. Unlike
// `MaterialName`, it is trimmed: surrounding whitespace carries no meaning in
// a code, and a code that is nothing but whitespace is rejected. Codes are
// unique: a domain rule that no single `Material` can enforce, since it spans
// every material. So the register/edit handlers check it through
// `MaterialRepository.findByCode`, with the `code` column's unique index as a
// backstop.
export class MaterialCode extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(code: string): MaterialCode {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new Error('Material code value must not be empty');
    }
    return new MaterialCode(toAsciiDigits(trimmed));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
