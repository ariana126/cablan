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

/** Every 7 days from 07/01, restarted on 07/20 from 07/25 (issue #110). */
function restarted() {
  return scheduleFrom('2026-09-23', 7).restartedOn(
    date('2026-10-12'),
    date('2026-10-17'),
  );
}

/**
 * Every 7 days from 07/01; restarted 07/20 from 08/20, then — its equipment
 * retired again before 08/20 — restarted 08/10 from 08/12.
 */
function twiceRestarted() {
  return scheduleFrom('2026-07-01', 7)
    .restartedOn(date('2026-07-20'), date('2026-08-20'))
    .restartedOn(date('2026-08-10'), date('2026-08-12'));
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

  describe('the due dates in a range', () => {
    const schedule = scheduleFrom('2026-07-01', 7);

    it('includes a due date on either bound', () => {
      expect(
        dates(schedule.dueDatesBetween(date('2026-07-08'), date('2026-07-22'))),
      ).toEqual(['2026-07-08', '2026-07-15', '2026-07-22']);
    });

    it('holds only the due dates inside it', () => {
      expect(
        dates(schedule.dueDatesBetween(date('2026-07-09'), date('2026-07-21'))),
      ).toEqual(['2026-07-15']);
    });

    it('starts at the first due date when it opens before it', () => {
      expect(
        dates(schedule.dueDatesBetween(date('2026-06-01'), date('2026-07-10'))),
      ).toEqual(['2026-07-01', '2026-07-08']);
    });

    it('is empty before the first due date', () => {
      expect(
        schedule.dueDatesBetween(date('2026-06-01'), date('2026-06-30')),
      ).toEqual([]);
    });

    it('reaches months ahead, without the dates before it', () => {
      expect(
        dates(schedule.dueDatesBetween(date('2027-01-01'), date('2027-01-20'))),
      ).toEqual(['2027-01-06', '2027-01-13', '2027-01-20']);
    });

    it('is a single day when both bounds are one due date', () => {
      expect(
        dates(schedule.dueDatesBetween(date('2026-07-15'), date('2026-07-15'))),
      ).toEqual(['2026-07-15']);
    });

    it('follows each segment under its own interval (7 → 10 from 07/15)', () => {
      const changed = schedule.withIntervalChangedFrom(
        date('2026-07-15'),
        IntervalDays.of(10),
      );

      expect(
        dates(changed.dueDatesBetween(date('2026-07-05'), date('2026-08-04'))),
      ).toEqual(['2026-07-08', '2026-07-15', '2026-07-25', '2026-08-04']);
    });

    it('skips the segments that end before it', () => {
      const changed = scheduleFrom('2026-07-01', 30)
        .withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(15))
        .withIntervalChangedFrom(date('2026-07-16'), IntervalDays.of(5));

      expect(
        dates(changed.dueDatesBetween(date('2026-07-20'), date('2026-07-31'))),
      ).toEqual(['2026-07-21', '2026-07-26', '2026-07-31']);
    });

    it('runs to the last calendar day without stepping past it', () => {
      const century = scheduleFrom('2100-01-01', 36_500);

      expect(
        dates(century.dueDatesBetween(date('9800-01-01'), date('9999-12-31'))),
      ).toEqual(['9894-10-28', '9994-10-04']);
    });
  });

  describe('the latest due date on or before a day', () => {
    const schedule = scheduleFrom('2026-07-01', 7).withIntervalChangedFrom(
      date('2026-07-15'),
      IntervalDays.of(10),
    );

    it.each([
      ['2026-06-30', null],
      ['2026-07-01', '2026-07-01'],
      ['2026-07-14', '2026-07-08'],
      ['2026-07-15', '2026-07-15'],
      ['2026-07-24', '2026-07-15'],
      ['2026-07-25', '2026-07-25'],
    ])('is %s → %s', (day, expected) => {
      expect(
        schedule.latestDueDateOnOrBefore(date(day))?.asString() ?? null,
      ).toBe(expected);
    });
  });

  it('names the occurrence after a due date across an interval change', () => {
    const schedule = scheduleFrom('2026-07-01', 7).withIntervalChangedFrom(
      date('2026-07-15'),
      IntervalDays.of(10),
    );

    expect(
      dates([
        schedule.occurrenceAfter(date('2026-07-08')),
        schedule.occurrenceAfter(date('2026-07-14')),
        schedule.occurrenceAfter(date('2026-07-15')),
        schedule.occurrenceAfter(date('2026-06-01')),
      ]),
    ).toEqual(['2026-07-15', '2026-07-15', '2026-07-25', '2026-07-01']);
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

  // Issue #110. Every 7 days from 2026-09-23 (Jalali 1405/07/01), restarted
  // when its equipment is reactivated on 2026-10-12 (07/20) with a new first
  // due date of 2026-10-17 (07/25).
  describe('restarting it on reactivation', () => {
    it('falls due on the new first due date, then every interval, keeping the interval (07/25, 08/02)', () => {
      expect(
        dates(
          restarted().dueDatesBetween(date('2026-10-12'), date('2026-10-24')),
        ),
      ).toEqual(['2026-10-17', '2026-10-24']);
      expect(restarted().intervalDays().asNumber()).toBe(7);
    });

    it('stops the previous calendar on the day it restarts (no 07/22)', () => {
      expect(
        dates(
          restarted().dueDatesBetween(date('2026-09-23'), date('2026-10-17')),
        ),
      ).toEqual(['2026-09-23', '2026-09-30', '2026-10-07', '2026-10-17']);
      expect(dates(restarted().dueDatesThrough(date('2026-10-17')))).toEqual([
        '2026-09-23',
        '2026-09-30',
        '2026-10-07',
        '2026-10-17',
      ]);
    });

    it('names the new first due date after the last due date before the restart', () => {
      expect(restarted().occurrenceAfter(date('2026-10-07')).asString()).toBe(
        '2026-10-17',
      );
      expect(restarted().occurrenceAfter(date('2026-10-13')).asString()).toBe(
        '2026-10-17',
      );
    });

    it('has, before the new first due date, the last due date of the previous calendar as the latest one', () => {
      expect(
        restarted().latestDueDateOnOrBefore(date('2026-10-15'))?.asString(),
      ).toBe('2026-10-07');
      expect(
        restarted().latestDueDateOnOrBefore(date('2026-10-17'))?.asString(),
      ).toBe('2026-10-17');
    });

    it('may start on the restart day itself', () => {
      const today = scheduleFrom('2026-09-23', 7).restartedOn(
        date('2026-10-12'),
        date('2026-10-12'),
      );

      expect(
        dates(today.dueDatesBetween(date('2026-10-01'), date('2026-10-19'))),
      ).toEqual(['2026-10-07', '2026-10-12', '2026-10-19']);
    });

    it('refuses a new first due date before the restart day', () => {
      expect(() =>
        scheduleFrom('2026-09-23', 7).restartedOn(
          date('2026-10-12'),
          date('2026-10-11'),
        ),
      ).toThrow();
    });

    it('replaces the segments that had not begun by the restart day', () => {
      const firstDueAhead = scheduleFrom('2026-10-20', 7).restartedOn(
        date('2026-10-12'),
        date('2026-10-15'),
      );

      expect(firstDueAhead.firstDueDate().asString()).toBe('2026-10-15');
      expect(
        dates(
          firstDueAhead.dueDatesBetween(date('2026-10-01'), date('2026-10-22')),
        ),
      ).toEqual(['2026-10-15', '2026-10-22']);
    });

    it('takes a later interval change from one of its due dates', () => {
      const changed = restarted().withIntervalChangedFrom(
        date('2026-10-24'),
        IntervalDays.of(10),
      );

      expect(
        dates(changed.dueDatesBetween(date('2026-10-01'), date('2026-11-05'))),
      ).toEqual(['2026-10-07', '2026-10-17', '2026-10-24', '2026-11-03']);
    });

    it('stays a restart when an interval change from its first due date replaces it', () => {
      const changed = restarted().withIntervalChangedFrom(
        date('2026-10-17'),
        IntervalDays.of(10),
      );

      expect(
        dates(changed.dueDatesBetween(date('2026-10-01'), date('2026-10-30'))),
      ).toEqual(['2026-10-07', '2026-10-17', '2026-10-27']);
    });

    it('is rebuilt from its stored segments, the restart day kept', () => {
      expect(PmSchedule.fromSegments(restarted().segments())).toEqual(
        restarted(),
      );
      expect(restarted().segments()[1].restartedOn?.asString()).toBe(
        '2026-10-12',
      );
    });

    it('cannot be rebuilt from a restart whose first due date precedes its restart day', () => {
      expect(() =>
        PmSchedule.fromSegments([
          {
            startDueDate: date('2026-09-23'),
            intervalDays: IntervalDays.of(7),
          },
          {
            startDueDate: date('2026-10-10'),
            intervalDays: IntervalDays.of(7),
            restartedOn: date('2026-10-12'),
          },
        ]),
      ).toThrow();
    });

    // Code review: a restart whose first due date was never reached — its
    // equipment retired again first — still took over on its own day.
    // Every 7 days from 07/01; restarted 07/20 from 08/20; restarted again
    // 08/10 from 08/12.
    describe('after a restart whose first due date was never reached', () => {
      it('never runs the original calendar again after the first restart (no 07/22, 07/29, 08/05)', () => {
        expect(
          dates(
            twiceRestarted().dueDatesBetween(
              date('2026-07-01'),
              date('2026-08-31'),
            ),
          ),
        ).toEqual([
          '2026-07-01',
          '2026-07-08',
          '2026-07-15',
          '2026-08-12',
          '2026-08-19',
          '2026-08-26',
        ]);
      });

      it('names the second restart’s first due date after the last one before the first', () => {
        expect(
          twiceRestarted().occurrenceAfter(date('2026-07-15')).asString(),
        ).toBe('2026-08-12');
        expect(
          twiceRestarted().occurrenceAfter(date('2026-07-25')).asString(),
        ).toBe('2026-08-12');
      });

      it('has the original calendar’s last due date as the latest until the second restart is due', () => {
        expect(
          twiceRestarted()
            .latestDueDateOnOrBefore(date('2026-08-11'))
            ?.asString(),
        ).toBe('2026-07-15');
      });

      it('holds a later segment’s due dates in a range the unreached restart’s first due date lies beyond', () => {
        expect(
          dates(
            twiceRestarted().dueDatesBetween(
              date('2026-08-10'),
              date('2026-08-15'),
            ),
          ),
        ).toEqual(['2026-08-12']);
      });

      it('is rebuilt from its stored segments', () => {
        expect(PmSchedule.fromSegments(twiceRestarted().segments())).toEqual(
          twiceRestarted(),
        );
      });

      it('continues the unreached restart’s calendar when the second reactivation keeps it (08/20)', () => {
        const continued = scheduleFrom('2026-07-01', 7).restartedOn(
          date('2026-07-20'),
          date('2026-08-20'),
        );

        expect(continued.occurrenceAfter(date('2026-08-09')).asString()).toBe(
          '2026-08-20',
        );
        expect(
          dates(
            continued.dueDatesBetween(date('2026-07-16'), date('2026-08-31')),
          ),
        ).toEqual(['2026-08-20', '2026-08-27']);
      });
    });

    it('cannot be rebuilt from a restart on or before the previous segment began', () => {
      expect(() =>
        PmSchedule.fromSegments([
          {
            startDueDate: date('2026-09-23'),
            intervalDays: IntervalDays.of(7),
          },
          {
            startDueDate: date('2026-09-25'),
            intervalDays: IntervalDays.of(7),
            restartedOn: date('2026-09-23'),
          },
        ]),
      ).toThrow();
    });
  });
});
