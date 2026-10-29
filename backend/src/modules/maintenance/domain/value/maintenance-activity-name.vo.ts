import { toAsciiDigits, ValueObject } from '@framework/domain';

/**
 * A maintenance activity's name — unique across the catalog (checked by the
 * command handlers). Trimmed, with Persian-keyboard digits stored as English
 * ones.
 */
export class MaintenanceActivityName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static fromString(name: string): MaintenanceActivityName {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Maintenance activity name must not be empty');
    }
    return new MaintenanceActivityName(toAsciiDigits(trimmed));
  }

  asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
