import { describe, expect, it } from 'vitest';

import { formatJalaliDateTime, parseJalaliDateTime } from './jalali-datetime';

describe('parseJalaliDateTime', () => {
  it('parses a Jalali date and time into the matching Gregorian instant', () => {
    // Nowruz 1403 fell on 20 March 2024 — the well-known anchor this conversion is verified against.
    expect(parseJalaliDateTime('1403/01/01 00:00')).toEqual(
      new Date(Date.UTC(2024, 2, 20, 0, 0, 0, 0)),
    );
  });

  it('parses every background fixture date this feature area is built against', () => {
    expect(parseJalaliDateTime('1403/04/01 08:30')).toEqual(
      new Date(Date.UTC(2024, 5, 21, 8, 30, 0, 0)),
    );
    expect(parseJalaliDateTime('1403/05/01 09:15')).toEqual(
      new Date(Date.UTC(2024, 6, 22, 9, 15, 0, 0)),
    );
  });

  it('defaults the time of day to midnight when only a date is given', () => {
    expect(parseJalaliDateTime('1403/04/01')).toEqual(new Date(Date.UTC(2024, 5, 21, 0, 0, 0, 0)));
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseJalaliDateTime('  1403/04/01 08:30  ')).toEqual(
      new Date(Date.UTC(2024, 5, 21, 8, 30, 0, 0)),
    );
  });

  it('returns undefined for text that is not a recognised Jalali date/time', () => {
    expect(parseJalaliDateTime('not a date')).toBeUndefined();
    expect(parseJalaliDateTime('')).toBeUndefined();
    expect(parseJalaliDateTime('1403/13/01')).toBeUndefined();
  });
});

describe('formatJalaliDateTime', () => {
  it('formats a Gregorian instant back into the Jalali text an operator would recognise', () => {
    expect(formatJalaliDateTime(new Date(Date.UTC(2024, 5, 21, 8, 30, 0, 0)))).toBe(
      '1403/04/01 08:30',
    );
  });

  it('round-trips through parseJalaliDateTime', () => {
    const original = '1403/05/01 09:15';
    expect(formatJalaliDateTime(parseJalaliDateTime(original)!)).toBe(original);
  });
});
