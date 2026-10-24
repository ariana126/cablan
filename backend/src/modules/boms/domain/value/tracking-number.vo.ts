import { toAsciiDigits, ValueObject } from '@framework/domain';

// The caller-supplied tracking number ("شماره ردیابی") a daily BOM is
// registered/edited against. Required and non-empty: clearing it on edit
// must be rejected, not silently applied — see the "tracking number" rule in
// registring-bom.feature.
export class TrackingNumber extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  // Deliberately no trimming or case normalisation, mirroring the other
  // string-backed value objects in this codebase.
  // Digits typed on a Persian keyboard (Persian or Arabic-Indic) are stored
  // as English ones, so «۱۲۳۴» and «1234» are one value — for equality,
  // uniqueness and lookups alike. Nothing else about the text changes.
  static fromString(trackingNumber: string): TrackingNumber {
    if (!trackingNumber.trim()) {
      throw new Error('Tracking number value must not be empty');
    }
    return new TrackingNumber(toAsciiDigits(trackingNumber));
  }

  public asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
