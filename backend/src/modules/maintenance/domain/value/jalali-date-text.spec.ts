import { calendarDateFromJalaliText, jalaliTextOf } from './jalali-date-text';

describe('calendarDateFromJalaliText', () => {
  it('reads a zero-padded Jalali date as its Gregorian calendar date', () => {
    expect(calendarDateFromJalaliText('1405/08/30')?.asString()).toBe(
      '2026-11-21',
    );
  });

  it('reads a one-digit day as the zero-padded one', () => {
    expect(calendarDateFromJalaliText('1405/10/1')?.asString()).toBe(
      '2026-12-22',
    );
  });

  it('reads Persian digits and surrounding spaces', () => {
    expect(calendarDateFromJalaliText(' ۱۴۰۵/۰۸/۳۰ ')?.asString()).toBe(
      '2026-11-21',
    );
  });

  it.each([
    ['a thirteenth month', '1405/13/01'],
    ['a month zero', '1405/00/10'],
    ['a 31st day of a 30-day month', '1405/07/31'],
    ['a day zero', '1405/07/00'],
    ['text', 'فردا'],
    ['a dash-separated date', '1405-08-30'],
    ['a Gregorian date', '2026/11/21'],
    ['a year before 2000', '1300/01/01'],
  ])('is nothing for %s', (_case, text) => {
    expect(calendarDateFromJalaliText(text)).toBeNull();
  });
});

describe('jalaliTextOf', () => {
  it('writes the UTC calendar day of a spreadsheet date cell in Jalali', () => {
    expect(jalaliTextOf(new Date(Date.UTC(2026, 10, 21)))).toBe('1405/08/30');
  });
});
