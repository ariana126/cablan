import { describe, expect, it } from 'vitest';

import { formatJalaliDateTime } from './jalali-datetime';

describe('formatJalaliDateTime', () => {
  it('renders a Gregorian instant as the Jalali text an operator would recognise', () => {
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).toBe('1403/04/01 08:30');
  });

  it('converts against the well-known anchor: Nowruz 1403 fell on 20 March 2024', () => {
    expect(formatJalaliDateTime(new Date(2024, 2, 20, 0, 0, 0, 0))).toBe('1403/01/01 00:00');
  });

  it('renders every background fixture instant this feature area is built against', () => {
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).toBe('1403/04/01 08:30');
    expect(formatJalaliDateTime(new Date(2024, 6, 22, 9, 15, 0, 0))).toBe('1403/05/01 09:15');
  });

  it('reads the time of day in the viewer’s own timezone, not UTC', () => {
    // The local-time convention: the wall-clock hour an operator sees is the one they are standing
    // in, whatever offset the instant carries.
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).toContain('08:30');
  });

  it('writes ASCII digits, not Persian ones', () => {
    // `features/boms/bom-report-export.ts` relies on this: a spreadsheet cell carrying
    // Persian-Indic numerals is not a date to anything that reads the file.
    expect(formatJalaliDateTime(new Date(2024, 5, 21, 8, 30, 0, 0))).toMatch(/^[\d/: ]+$/);
  });
});
