import { describe, expect, it } from 'vitest';

import { operatingHoursError, parseOperatingHours } from './operating-hours';

describe('parseOperatingHours', () => {
  it.each([
    ['1250.5', 1250.5],
    ['0', 0],
    ['12', 12],
    ['1000000', 1000000],
    ['3.25', 3.25],
    ['  42  ', 42],
    ['۱۲۵۰٫۵', 1250.5],
    ['۱۲۵۰.۵', 1250.5],
    ['٣٤', 34],
  ])('reads «%s» as %s hours', (text, hours) => {
    expect(parseOperatingHours(text)).toBe(hours);
  });

  it.each(['', '   '])('reads «%s» as nothing given', (text) => {
    expect(parseOperatingHours(text)).toBeNull();
  });

  it.each(['دوازده', 'abc', '-5', '1.234', '12a', '1,5', '.5', '5.', '1e3', '1000000.01'])(
    'cannot read «%s»',
    (text) => {
      expect(parseOperatingHours(text)).toBeUndefined();
    },
  );
});

describe('operatingHoursError', () => {
  it('has nothing to say about a reading or an empty field', () => {
    expect(operatingHoursError('1250.5')).toBeUndefined();
    expect(operatingHoursError('')).toBeUndefined();
  });

  it('names the field and says what it takes, for text, a negative or too many decimals', () => {
    for (const text of ['دوازده', 'abc', '-5', '1.234']) {
      expect(operatingHoursError(text)).toBe(
        'ساعت کارکرد باید عددی صفر یا بیشتر با حداکثر دو رقم اعشار باشد.',
      );
    }
  });

  it('names the ceiling when the reading is too large', () => {
    expect(operatingHoursError('1000001')).toBe('ساعت کارکرد نمی‌تواند بیشتر از ۱٬۰۰۰٬۰۰۰ باشد.');
  });
});
