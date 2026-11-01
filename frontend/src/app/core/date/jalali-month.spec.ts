import { describe, expect, it } from 'vitest';

import { toIsoCalendarDate } from './calendar-date';
import { JalaliMonth } from './jalali-month';

const iso = toIsoCalendarDate;

describe('JalaliMonth', () => {
  it('is the Jalali month a day falls in', () => {
    // 1 November 2026 is 1405/08/10.
    const month = JalaliMonth.containing(new Date(2026, 10, 1, 15, 30));

    expect(month.year).toBe(1405);
    expect(month.month).toBe(8);
  });

  it('runs from its first to its last day, as local midnights', () => {
    const aban = JalaliMonth.of(1405, 8);

    expect(iso(aban.firstDay)).toBe('2026-10-23');
    expect(iso(aban.lastDay)).toBe('2026-11-21');
    expect(aban.firstDay.getHours()).toBe(0);
    expect(aban.lastDay.getHours()).toBe(0);
  });

  it('knows the 31-day months of the first half and the short Esfand', () => {
    expect(iso(JalaliMonth.of(1405, 1).lastDay)).toBe('2026-04-20');
    expect(iso(JalaliMonth.of(1404, 12).firstDay)).toBe('2026-02-20');
    expect(iso(JalaliMonth.of(1404, 12).lastDay)).toBe('2026-03-20');
  });

  it('steps forward and back across a year boundary', () => {
    expect(JalaliMonth.of(1405, 12).plus(1).equals(JalaliMonth.of(1406, 1))).toBe(true);
    expect(JalaliMonth.of(1405, 1).plus(-1).equals(JalaliMonth.of(1404, 12))).toBe(true);
    expect(JalaliMonth.of(1405, 8).plus(2).equals(JalaliMonth.of(1405, 10))).toBe(true);
  });

  it('is titled by its Persian name and year, in Persian digits', () => {
    expect(JalaliMonth.of(1405, 10).title).toBe('دی ۱۴۰۵');
    expect(JalaliMonth.of(1405, 8).title).toBe('آبان ۱۴۰۵');
  });

  it('lays its days out in whole weeks, Saturday first, padded with the neighbouring months', () => {
    // 1405/08/01 is a Friday, the last column of its week; 1405/08/30 a Saturday, the first.
    const days = JalaliMonth.of(1405, 8).weeks().flat();

    expect(days).toHaveLength(42);
    expect(days.slice(0, 7).map((day) => [iso(day.date), day.inMonth])).toEqual([
      ['2026-10-17', false],
      ['2026-10-18', false],
      ['2026-10-19', false],
      ['2026-10-20', false],
      ['2026-10-21', false],
      ['2026-10-22', false],
      ['2026-10-23', true],
    ]);
    expect(days.filter((day) => day.inMonth)).toHaveLength(30);
    expect(days.every((day, index) => (index % 7 === 0 ? day.date.getDay() === 6 : true))).toBe(
      true,
    );
    expect(iso(days[days.length - 1].date)).toBe('2026-11-27');
  });

  it('needs no padding week when the month starts on a Saturday and fills its last week', () => {
    // 1405/01/01 (21 March 2026) is a Saturday.
    const weeks = JalaliMonth.of(1405, 1).weeks();

    expect(weeks[0][0].date.getDay()).toBe(6);
    expect(weeks[0][0].inMonth).toBe(true);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // 31 days from a Saturday: four full weeks and three days into a fifth.
    expect(weeks).toHaveLength(5);
  });
});
