import { ValueObject } from '@framework/domain';

// A material's optional code — e.g. a supplier or warehouse reference. Unlike
// `MaterialName`, it is trimmed: surrounding whitespace carries no meaning in
// a code, and a code that is nothing but whitespace is no code at all. There is
// deliberately no uniqueness rule: two materials may share a code.
export class MaterialCode extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static fromString(code: string): MaterialCode {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new Error('Material code value must not be empty');
    }
    return new MaterialCode(trimmed);
  }

  /**
   * The edge of "a material may have no code": a missing or blank value is
   * no code (`null`), anything else is a trimmed `MaterialCode`.
   */
  static fromOptionalString(
    code: string | null | undefined,
  ): MaterialCode | null {
    return code?.trim() ? MaterialCode.fromString(code) : null;
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
