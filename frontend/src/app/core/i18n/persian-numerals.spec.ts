import { describe, expect, it } from 'vitest';

import { formatPersianNumber, toPersianDigits } from './persian-numerals';

describe('formatPersianNumber', () => {
  it('writes a whole number in Persian digits', () => {
    expect(formatPersianNumber(87)).toBe('۸۷');
  });

  it('groups thousands and marks the decimal the Persian way', () => {
    expect(formatPersianNumber(1234.5)).toBe('۱٬۲۳۴٫۵');
  });

  it('writes zero rather than nothing', () => {
    expect(formatPersianNumber(0)).toBe('۰');
  });

  it('renders a negative quantity', () => {
    expect(formatPersianNumber(-12)).toContain('۱۲');
  });

  it('gives an empty string for a value that is not a finite number', () => {
    // Reached whenever an API omits a numeric field: rendering "NaN" in a table cell helps nobody.
    expect(formatPersianNumber(Number.NaN)).toBe('');
    expect(formatPersianNumber(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('toPersianDigits', () => {
  it('swaps digits and leaves the rest of the string alone', () => {
    expect(toPersianDigits('1403/04/01 08:30')).toBe('۱۴۰۳/۰۴/۰۱ ۰۸:۳۰');
  });

  it('does not regroup — a date is not a quantity', () => {
    expect(toPersianDigits('1403/04/01')).not.toContain('٬');
  });

  it('leaves Persian text between the digits untouched', () => {
    expect(toPersianDigits('1 تا 20 از 87')).toBe('۱ تا ۲۰ از ۸۷');
  });

  it('leaves a string with no digits exactly as it was', () => {
    expect(toPersianDigits('بدون عدد')).toBe('بدون عدد');
  });
});
