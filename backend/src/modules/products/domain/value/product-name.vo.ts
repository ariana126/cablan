import { ValueObject } from '@framework/domain';

export class ProductName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring ComponentName
  // and MaterialName: product names are compared case-sensitively.
  static fromString(name: string): ProductName {
    if (!name.trim()) {
      throw new Error('Product name value must not be empty');
    }
    return new ProductName(name);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
