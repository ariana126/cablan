import { ValueObject } from '@framework/domain';

export class Brand extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring the other
  // string-backed value objects in this codebase.
  static fromString(brand: string): Brand {
    if (!brand.trim()) {
      throw new Error('Brand value must not be empty');
    }
    return new Brand(brand);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
