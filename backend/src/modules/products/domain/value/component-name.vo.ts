import { ValueObject } from '@framework/domain';

export class ComponentName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring MaterialName:
  // component names are compared case-sensitively, so "Bolt" and "bolt" must
  // count as different components.
  static fromString(name: string): ComponentName {
    if (!name.trim()) {
      throw new Error('Component name value must not be empty');
    }
    return new ComponentName(name);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
