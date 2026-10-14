import { describe, expect, it } from 'vitest';

import { formatJalaliDateTime } from './jalali-datetime';

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
