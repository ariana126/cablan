import { describe, expect, it } from 'vitest';

import { toIsoCalendarDate } from './calendar-date';
import { tehranToday } from './tehran-today';

describe('tehranToday', () => {
  it('is the Tehran calendar day, even where the browser’s own clock is still on the day before', () => {
    // 00:30 on 1 November in Tehran (UTC+3:30) is 21:00 on 31 October in UTC.
    expect(toIsoCalendarDate(tehranToday(new Date('2026-10-31T21:00:00Z')))).toBe('2026-11-01');
  });

  it('stays on the Tehran day until Tehran’s midnight', () => {
    expect(toIsoCalendarDate(tehranToday(new Date('2026-11-01T20:29:00Z')))).toBe('2026-11-01');
    expect(toIsoCalendarDate(tehranToday(new Date('2026-11-01T20:31:00Z')))).toBe('2026-11-02');
  });

  it('is a local midnight, as a datepicker writes a picked day', () => {
    const today = tehranToday(new Date('2026-11-01T10:00:00Z'));

    expect([today.getHours(), today.getMinutes(), today.getSeconds()]).toEqual([0, 0, 0]);
  });
});
