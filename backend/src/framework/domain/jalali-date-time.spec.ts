import { formatJalaliDateTime, jalaliDateAndTime } from './jalali-date-time';

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

describe('jalaliDateAndTime', () => {
  it('splits the Jalali date from the zero-padded time of day, read in the given time zone', () => {
    expect(
      jalaliDateAndTime(new Date('2024-09-05T06:30:00.000Z'), 'Asia/Tehran'),
    ).toEqual({ date: '1403/06/15', time: '10:00' });
  });

  it('writes an afternoon time on the 24-hour clock', () => {
    expect(
      jalaliDateAndTime(new Date('2024-09-05T11:35:00.000Z'), 'Asia/Tehran'),
    ).toEqual({ date: '1403/06/15', time: '15:05' });
  });
});
