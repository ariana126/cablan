import { toAsciiDigits, ValueObject } from '@framework/domain';

/**
 * The tracking number a QC record is made for («شماره ردیابی»): any text
 * the inspector reads off the product, never looked up anywhere (no daily BOM
 * need carry it). Trimmed and never blank, with Persian-keyboard digits
 * stored as English ones, so «TR-۱۰۰» and «TR-100» are one tracking number.
 * At most 100 characters, enforced by the DTO.
 */
export class QcTrackingNumber extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static fromString(trackingNumber: string): QcTrackingNumber {
    const trimmed = trackingNumber.trim();
    if (!trimmed) {
      throw new Error('QC tracking number must not be blank');
    }
    return new QcTrackingNumber(toAsciiDigits(trimmed));
  }

  asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
