import { ValueObject } from '@framework/domain';

// The unique business code identifying a standard BOM. Uniqueness is not a
// property of the value itself — it's an application-layer invariant,
// enforced by `StandardBomRepository.findByMiCode` (see the register/edit
// handlers) — this value object only guards non-emptiness.
export class MiCode extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring ComponentName/
  // MaterialName/ProductName: MI codes are compared case-sensitively.
  static fromString(miCode: string): MiCode {
    if (!miCode.trim()) {
      throw new Error('MI code value must not be empty');
    }
    return new MiCode(miCode);
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
