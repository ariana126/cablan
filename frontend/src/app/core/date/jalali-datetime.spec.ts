import { describe, expect, it } from 'vitest';

import { formatJalaliDateTime, formatJalaliDateTimeInLatinDigits } from './jalali-datetime';

describe('formatJalaliDateTime', () => {
  it('renders a Gregorian instant as the Jalali text an operator reads, in Persian digits', () => {
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).toBe('۱۴۰۳/۰۴/۰۱ ۰۸:۳۰');
  });

  it('converts against the well-known anchor: Nowruz 1403 fell on 20 March 2024', () => {
    expect(formatJalaliDateTime(new Date(2024, 2, 20, 0, 0, 0, 0))).toBe('۱۴۰۳/۰۱/۰۱ ۰۰:۰۰');
  });

  it('never groups the year — it is a year, not a quantity', () => {
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).not.toContain('٬');
  });

  it('reads the time of day in the viewer’s own timezone, not UTC', () => {
    // The local-time convention: the wall-clock hour an operator sees is the one they are standing
    // in, whatever offset the instant carries.
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).toContain('۰۸:۳۰');
  });
});

describe('formatJalaliDateTimeInLatinDigits', () => {
  it('renders the same instant with Latin digits', () => {
    expect(formatJalaliDateTimeInLatinDigits(new Date(2024, 5, 21, 8, 30, 0, 0))).toBe(
      '1403/04/01 08:30',
    );
  });

  it('renders every background fixture instant this feature area is built against', () => {
    expect(formatJalaliDateTimeInLatinDigits(new Date(2024, 5, 21, 8, 30, 0, 0))).toBe(
      '1403/04/01 08:30',
    );
    expect(formatJalaliDateTimeInLatinDigits(new Date(2024, 6, 22, 9, 15, 0, 0))).toBe(
      '1403/05/01 09:15',
    );
  });

  it('writes nothing but Latin digits and separators', () => {
    // `features/boms/bom-report-export.ts` relies on this: a spreadsheet cell carrying
    // Persian-Indic numerals is not a date to anything that reads the file.
    expect(formatJalaliDateTimeInLatinDigits(new Date(2024, 5, 21, 8, 30, 0, 0))).toMatch(
      /^[\d/: ]+$/,
    );
  });
});
