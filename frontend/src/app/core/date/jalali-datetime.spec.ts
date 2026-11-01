import { describe, expect, it } from 'vitest';

import { formatJalaliDateTime, formatTehranJalaliDateTime } from './jalali-datetime';

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

describe('formatTehranJalaliDateTime', () => {
  it('reads an ISO instant on Tehran’s wall clock (UTC+03:30), in Persian digits', () => {
    expect(formatTehranJalaliDateTime('2026-10-02T06:30:00.000Z')).toBe('۱۴۰۵/۰۷/۱۰ ۱۰:۰۰');
  });

  it('takes Tehran’s calendar day, even where UTC is still on the day before', () => {
    // 21:00 UTC is already half past midnight in Tehran.
    expect(formatTehranJalaliDateTime('2026-10-02T21:00:00.000Z')).toBe('۱۴۰۵/۰۷/۱۱ ۰۰:۳۰');
  });

  it('does not depend on the browser’s own zone, even across its daylight-saving gap', () => {
    // 02:30 on 8 March 2026 in Tehran is a wall-clock time that does not exist in New York, whose
    // clocks jump from 02:00 to 03:00 that night.
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
      .process.env;
    const zone = env['TZ'];
    env['TZ'] = 'America/New_York';
    try {
      expect(formatTehranJalaliDateTime('2026-03-07T23:00:00.000Z')).toBe('۱۴۰۴/۱۲/۱۷ ۰۲:۳۰');
    } finally {
      if (zone === undefined) {
        delete env['TZ'];
      } else {
        env['TZ'] = zone;
      }
    }
  });
});
