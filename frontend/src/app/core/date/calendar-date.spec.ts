import { describe, expect, it } from 'vitest';

import { formatJalaliCalendarDate, toIsoCalendarDate } from './calendar-date';

describe('toIsoCalendarDate', () => {
  it('writes the picked day as the API takes a date, from its local calendar fields', () => {
    // 1405/07/01 as the Jalali calendar picks it: local midnight of 23 September 2026.
    expect(toIsoCalendarDate(new Date(2026, 8, 23))).toBe('2026-09-23');
  });

  it('zero-pads the month and the day', () => {
    expect(toIsoCalendarDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  // A late-evening pick must not slide to the next day through a UTC conversion.
  it('keeps the local day whatever the time of day', () => {
    expect(toIsoCalendarDate(new Date(2026, 8, 23, 23, 45))).toBe('2026-09-23');
  });
});

describe('formatJalaliCalendarDate', () => {
  it('shows an ISO date as a zero-padded Jalali date in Persian digits', () => {
    expect(formatJalaliCalendarDate('2026-09-23')).toBe('۱۴۰۵/۰۷/۰۱');
    expect(formatJalaliCalendarDate('2026-10-07')).toBe('۱۴۰۵/۰۷/۱۵');
  });

  it('reads the date as a calendar day, never as a UTC instant', () => {
    expect(formatJalaliCalendarDate('2026-03-21')).toBe('۱۴۰۵/۰۱/۰۱');
  });

  it('shows a dash for text that is not an ISO date', () => {
    expect(formatJalaliCalendarDate('')).toBe('—');
    expect(formatJalaliCalendarDate('not-a-date')).toBe('—');
  });
});
