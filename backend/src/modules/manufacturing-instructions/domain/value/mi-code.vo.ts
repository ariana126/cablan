import { toAsciiDigits, ValueObject } from '@framework/domain';

// The unique business code identifying a standard BOM. Uniqueness is not a
// property of the value itself — it's an application-layer invariant,
// enforced by `ManufacturingInstructionRepository.findByMiCode` (see the register/edit
// handlers) — this value object only guards non-emptiness.
export class MiCode extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring ComponentName/
  // MaterialName/ProductName: MI codes are compared case-sensitively.
  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(miCode: string): MiCode {
    if (!miCode.trim()) {
      throw new Error('MI code value must not be empty');
    }
    return new MiCode(toAsciiDigits(miCode));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
