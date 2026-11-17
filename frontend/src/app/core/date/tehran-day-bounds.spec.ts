import { describe, expect, it } from 'vitest';

import { tehranDayEnd, tehranDayStart } from './tehran-day-bounds';

/** A calendar day as the date-only pickers write it: the local midnight of that day. */
const day = (year: number, month: number, date: number): Date => new Date(year, month - 1, date);

describe('tehranDayStart', () => {
  it('is the instant Tehran’s calendar day begins, whatever the browser’s own zone', () => {
    // 1405/07/01 is 2026-09-23; Tehran is UTC+03:30 all year since 2022.
    expect(tehranDayStart(day(2026, 9, 23))).toBe('2026-09-22T20:30:00.000Z');
  });
});

describe('tehranDayEnd', () => {
  it('is the last millisecond of Tehran’s calendar day, so the day is included', () => {
    expect(tehranDayEnd(day(2026, 9, 23))).toBe('2026-09-23T20:29:59.999Z');
  });
});
