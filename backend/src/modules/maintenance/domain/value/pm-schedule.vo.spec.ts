import { CalendarDate } from './calendar-date.vo';
import { IntervalDays } from './interval-days.vo';
import { PmSchedule } from './pm-schedule.vo';

const date = (value: string) => CalendarDate.fromString(value);
const dates = (values: CalendarDate[]) => values.map((d) => d.asString());

function scheduleFrom(firstDueDate: string, intervalDays: number) {
  return PmSchedule.startingOn(
    date(firstDueDate),
    IntervalDays.of(intervalDays),
  );
}

describe('PmSchedule', () => {
  it('falls due on its first due date, then every interval after it', () => {
    const schedule = scheduleFrom('2026-07-01', 7);

    expect(dates(schedule.dueDatesThrough(date('2026-07-22')))).toEqual([
      '2026-07-01',
      '2026-07-08',
      '2026-07-15',
      '2026-07-22',
    ]);
  });

  it('reports its first due date and current interval', () => {
    const schedule = scheduleFrom('2026-07-01', 7);

    expect(schedule.firstDueDate().asString()).toBe('2026-07-01');
    expect(schedule.intervalDays().asNumber()).toBe(7);
  });

  describe('the current occurrence', () => {
    const schedule = scheduleFrom('2026-07-01', 7);

    it('is the first due date while that is still ahead', () => {
      expect(schedule.currentOccurrence(date('2026-06-29')).asString()).toBe(
        '2026-07-01',
      );
    });

    it('is the due date itself on the day it falls due', () => {
      expect(schedule.currentOccurrence(date('2026-07-08')).asString()).toBe(
        '2026-07-08',
      );
    });

    it('is the latest due date reached, between two due dates', () => {
      expect(schedule.currentOccurrence(date('2026-07-14')).asString()).toBe(
        '2026-07-08',
      );
    });
  });

  it('names the occurrence after a due date', () => {
    expect(
      scheduleFrom('2026-07-01', 7)
        .occurrenceAfter(date('2026-07-08'))
        .asString(),
    ).toBe('2026-07-15');
  });

  it('names, in one pass, the due dates reached and the next one ahead', () => {
    const window = scheduleFrom('2026-07-01', 7).occurrenceWindow(
      date('2026-07-15'),
    );

    expect(dates(window.reached)).toEqual([
      '2026-07-01',
      '2026-07-08',
      '2026-07-15',
    ]);
    expect(window.next.asString()).toBe('2026-07-22');
  });

  it('names no due date reached, and the first as next, before the first due date', () => {
    const window = scheduleFrom('2026-07-08', 7).occurrenceWindow(
      date('2026-07-01'),
    );

    expect(window.reached).toEqual([]);
    expect(window.next.asString()).toBe('2026-07-08');
  });

  describe('changing the interval', () => {
    it('restarts the schedule from the given due date with the new interval (30 → 15 from 07/01)', () => {
      const schedule = scheduleFrom('2026-07-01', 30).withIntervalChangedFrom(
        date('2026-07-01'),
        IntervalDays.of(15),
      );

      expect(dates(schedule.dueDatesThrough(date('2026-08-01')))).toEqual([
        '2026-07-01',
        '2026-07-16',
        '2026-07-31',
      ]);
      expect(schedule.intervalDays().asNumber()).toBe(15);
    });

    it('keeps the due dates before the restart under the old interval', () => {
      const schedule = scheduleFrom('2026-07-01', 7).withIntervalChangedFrom(
        date('2026-07-15'),
        IntervalDays.of(10),
      );

      expect(dates(schedule.dueDatesThrough(date('2026-08-01')))).toEqual([
        '2026-07-01',
        '2026-07-08',
        '2026-07-15',
        '2026-07-25',
      ]);
    });

    it('restarts from a due date still ahead (every 30 → 20 from 07/31)', () => {
      const schedule = scheduleFrom('2026-07-01', 30).withIntervalChangedFrom(
        date('2026-07-31'),
        IntervalDays.of(20),
      );

      expect(dates(schedule.dueDatesThrough(date('2026-08-20')))).toEqual([
        '2026-07-01',
        '2026-07-31',
        '2026-08-20',
      ]);
    });

    it('replaces, rather than stacks, a change from the same due date', () => {
      const schedule = scheduleFrom('2026-07-01', 30)
        .withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(15))
        .withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(10));

      expect(schedule.segments()).toEqual([
        { startDueDate: date('2026-07-01'), intervalDays: IntervalDays.of(10) },
      ]);
    });

    it('follows every segment in turn after several changes', () => {
      const schedule = scheduleFrom('2026-07-01', 30)
        .withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(15))
        .withIntervalChangedFrom(date('2026-07-16'), IntervalDays.of(5));

      expect(dates(schedule.dueDatesThrough(date('2026-07-27')))).toEqual([
        '2026-07-01',
        '2026-07-16',
        '2026-07-21',
        '2026-07-26',
      ]);
    });

    it('refuses to restart from a date that is not one of its due dates', () => {
      expect(() =>
        scheduleFrom('2026-07-01', 7).withIntervalChangedFrom(
          date('2026-07-05'),
          IntervalDays.of(10),
        ),
      ).toThrow();
    });

    it('refuses to restart before its last restart', () => {
      const schedule = scheduleFrom('2026-07-01', 7).withIntervalChangedFrom(
        date('2026-07-15'),
        IntervalDays.of(10),
      );

      expect(() =>
        schedule.withIntervalChangedFrom(
          date('2026-07-08'),
          IntervalDays.of(3),
        ),
      ).toThrow();
    });
  });

  it('is rebuilt from its stored segments', () => {
    const original = scheduleFrom('2026-07-01', 30)
      .withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(15))
      .withIntervalChangedFrom(date('2026-07-16'), IntervalDays.of(5));

    expect(PmSchedule.fromSegments(original.segments())).toEqual(original);
  });

  it('cannot be rebuilt from segments whose starts do not increase', () => {
    expect(() =>
      PmSchedule.fromSegments([
        { startDueDate: date('2026-07-08'), intervalDays: IntervalDays.of(7) },
        { startDueDate: date('2026-07-08'), intervalDays: IntervalDays.of(3) },
      ]),
    ).toThrow();
  });

  it('cannot be rebuilt from a segment starting off the previous one’s due dates', () => {
    expect(() =>
      PmSchedule.fromSegments([
        { startDueDate: date('2026-07-01'), intervalDays: IntervalDays.of(7) },
        { startDueDate: date('2026-07-10'), intervalDays: IntervalDays.of(3) },
      ]),
    ).toThrow();
  });

  it('cannot be rebuilt from no segments', () => {
    expect(() => PmSchedule.fromSegments([])).toThrow();
  });
});
