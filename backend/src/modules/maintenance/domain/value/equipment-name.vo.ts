import { toAsciiDigits, ValueObject } from '@framework/domain';

/**
 * A piece of equipment's name — unique across the register (checked by the
 * command handlers). Trimmed, and with Persian-keyboard digits stored as
 * English ones, so «دستگاه ۲» and «دستگاه 2» are one name.
 */
export class EquipmentName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static fromString(name: string): EquipmentName {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Equipment name must not be empty');
    }
    return new EquipmentName(toAsciiDigits(trimmed));
  }

  asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
