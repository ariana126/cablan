import { toAsciiDigits } from './ascii-digits';

describe('toAsciiDigits', () => {
  it('persian digits become english digits', () => {
    expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('arabic-indic digits become english digits', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('every other character is left as it is', () => {
    expect(toAsciiDigits('سیم-12/ب ۳')).toBe('سیم-12/ب 3');
  });

  it('text without any digit is unchanged', () => {
    expect(toAsciiDigits('مس قلع‌اندود')).toBe('مس قلع‌اندود');
  });
});
