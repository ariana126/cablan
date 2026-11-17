import { toAsciiDigits, ValueObject } from '@framework/domain';

/**
 * A QC activity's name («بازرسی ابعادی») — unique across the QC catalog
 * (checked by the command handlers). Trimmed, with Persian-keyboard digits
 * stored as English ones. At most 200 characters, enforced by the DTOs.
 */
export class QcActivityName extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static fromString(name: string): QcActivityName {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('QC activity name must not be empty');
    }
    return new QcActivityName(toAsciiDigits(trimmed));
  }

  asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
