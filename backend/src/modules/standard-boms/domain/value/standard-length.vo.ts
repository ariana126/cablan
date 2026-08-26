import { ValueObject } from '@framework/domain';

// The cable footage/length per drum a standard BOM is registered for
// (e.g. 305, 500, 100) — "متراژ استاندارد" in the business language.
export class StandardLength extends ValueObject {
  private constructor(private readonly value: number) {
    super();
  }

  static of(value: number): StandardLength {
    if (Number.isNaN(value) || value <= 0) {
      throw new Error('Standard length value must be a positive number');
    }
    return new StandardLength(value);
  }

  public asNumber(): number {
    return this.value;
  }
}
