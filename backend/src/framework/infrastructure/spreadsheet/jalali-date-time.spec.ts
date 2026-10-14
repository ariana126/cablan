import { formatJalaliDateTime } from './jalali-date-time';

describe('formatJalaliDateTime', () => {
  it('writes the Jalali date and time of day in Latin digits', () => {
    expect(
      formatJalaliDateTime(new Date('2024-06-21T08:30:00.000Z'), 'UTC'),
    ).toBe('1403/04/01 08:30');
  });

  it('reads the time of day in the given time zone', () => {
    expect(
      formatJalaliDateTime(new Date('2024-06-21T08:30:00.000Z'), 'Asia/Tehran'),
    ).toBe('1403/04/01 12:00');
  });

  it('rolls the Jalali date over when the time zone crosses midnight', () => {
    expect(
      formatJalaliDateTime(new Date('2024-06-21T22:00:00.000Z'), 'Asia/Tehran'),
    ).toBe('1403/04/02 01:30');
  });
});
