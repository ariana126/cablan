import { QcTrackingNumber } from './qc-tracking-number.vo';

describe('QcTrackingNumber', () => {
  it('is trimmed, with Persian-keyboard digits as English ones', () => {
    expect(QcTrackingNumber.fromString('  TR-۱۰۰ ').asString()).toBe('TR-100');
  });

  it('may be any text', () => {
    expect(QcTrackingNumber.fromString('بچ الف / 7').asString()).toBe(
      'بچ الف / 7',
    );
  });

  it.each(['', ' '.repeat(3), '\t\n'])(
    'refuses a blank tracking number (%p)',
    (value) => {
      expect(() => QcTrackingNumber.fromString(value)).toThrow();
    },
  );
});
