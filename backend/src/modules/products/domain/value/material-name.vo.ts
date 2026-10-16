import { ValueObject } from '@framework/domain';

export class MaterialName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring Username:
  // material names are compared case-sensitively, so "Steel Rod" and
  // "steel rod" must count as different materials.
  static fromString(name: string): MaterialName {
    if (!name.trim()) {
      throw new Error('Material name value must not be empty');
    }
    return new MaterialName(name);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
