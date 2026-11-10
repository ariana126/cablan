import { Identity } from '@framework/domain';

import { MaintenanceExecution } from './maintenance-execution.aggregate';
import { PmOccurrence, PmOccurrences } from './pm-occurrences';
import { CalendarDate } from './value/calendar-date.vo';
import { CalendarDateRange } from './value/calendar-date-range.vo';
import { IntervalDays } from './value/interval-days.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { PmSchedule } from './value/pm-schedule.vo';
import { ServiceGap } from './value/service-gap.vo';

const date = (value: string) => CalendarDate.fromString(value);
const range = (from: string, to: string) =>
  CalendarDateRange.between(date(from), date(to));

// A real execution, performed at 09:00 Tehran on `performedOn`: the on-time
// rule is the execution's own, so the calculator is tested against it.
function executed(dueDate: string, performedOn: string): MaintenanceExecution {
  return MaintenanceExecution.record({
    equipmentId: Identity.new(),
    equipmentName: 'اکسترودر',
    planItemId: Identity.new(),
    activityId: Identity.new(),
    activityName: 'تعویض روغن',
    dueDate: date(dueDate),
    performedAt: new Date(`${performedOn}T05:30:00.000Z`),
    performedById: Identity.new(),
    performedByName: 'مسلمی',
    notes: null,
    operatingHours: null,
  });
}

function occurrencesOf(
  firstDueDate: string,
  intervalDays: number,
  executions: MaintenanceExecution[] = [],
  stopDate: string | null = null,
) {
  return new PmOccurrences(
    PmSchedule.startingOn(date(firstDueDate), IntervalDays.of(intervalDays)),
    executions,
    stopDate ? date(stopDate) : null,
  );
}

function rows(occurrences: PmOccurrence<MaintenanceExecution>[]) {
  return occurrences.map((occurrence) => [
    occurrence.dueDate.asString(),
    occurrence.status,
  ]);
}

/** Every 7 days from 07/01, done on 07/01, read for July on 07/20. */
function stoppedOn(stopDate: string) {
  return rows(
    occurrencesOf(
      '2026-07-01',
      7,
      [executed('2026-07-01', '2026-07-01')],
      stopDate,
    ).occurrencesDueIn(range('2026-07-01', '2026-07-30'), date('2026-07-20')),
  );
}

/** Where the occurrence due `dueDate` of every 7 days from 07/01 sits, on 07/20. */
function calendarDateOf(dueDate: string, performedOn: string | null): string {
  return occurrencesOf(
    '2026-07-01',
    7,
    performedOn ? [executed(dueDate, performedOn)] : [],
  )
    .occurrenceOn(date(dueDate), date('2026-07-20'))
    .calendarDate.asString();
}

/** The day the occurrence due `dueDate` turned missed, as it stands `today`. */
function missedOnOf(
  occurrences: PmOccurrences<MaintenanceExecution>,
  dueDate: string,
  today: string,
): CalendarDate | null {
  return occurrences.occurrenceOn(date(dueDate), date(today)).missedOn;
}

/** The due dates of the occurrences missed by `today`, in `within` when given. */
function missedDueDates(
  occurrences: PmOccurrences<MaintenanceExecution>,
  today: string,
  within: [string, string] | null = null,
): string[] {
  return occurrences
    .occurrencesMissedIn(within ? range(...within) : null, date(today))
    .map((occurrence) => occurrence.dueDate.asString());
}

/** Every 7 days from 07/01, stopped (deactivated, or retired) on 07/10. */
function stopped() {
  return occurrencesOf('2026-07-01', 7, [], '2026-07-10');
}

/**
 * Every 7 days from 07/08, the 07/08 one done late on 07/10, read on 07/12:
 * what the calendar range holds, as [due, calendar date, status].
 */
function placed(from: string, to: string, stopDate: string | null = null) {
  return occurrencesOf(
    '2026-07-08',
    7,
    [executed('2026-07-08', '2026-07-10')],
    stopDate,
  )
    .occurrencesPlacedIn(range(from, to), date('2026-07-12'))
    .map((occurrence) => [
      occurrence.dueDate.asString(),
      occurrence.calendarDate.asString(),
      occurrence.status,
    ]);
}

describe('PmOccurrences', () => {
  describe('the status of an occurrence', () => {
    // Every row of the design's status table, for dₖ = 07/08 (dₖ₊₁ = 07/15).
    it.each`
      performedOn     | today           | status                         | daysOverdue
      ${'2026-07-08'} | ${'2026-07-20'} | ${PmOccurrenceStatus.OnTime}   | ${0}
      ${'2026-07-05'} | ${'2026-07-20'} | ${PmOccurrenceStatus.OnTime}   | ${0}
      ${'2026-07-09'} | ${'2026-07-20'} | ${PmOccurrenceStatus.Late}     | ${0}
      ${null}         | ${'2026-07-15'} | ${PmOccurrenceStatus.Missed}   | ${0}
      ${null}         | ${'2026-07-20'} | ${PmOccurrenceStatus.Missed}   | ${0}
      ${null}         | ${'2026-07-09'} | ${PmOccurrenceStatus.Overdue}  | ${1}
      ${null}         | ${'2026-07-14'} | ${PmOccurrenceStatus.Overdue}  | ${6}
      ${null}         | ${'2026-07-08'} | ${PmOccurrenceStatus.Due}      | ${0}
      ${null}         | ${'2026-07-07'} | ${PmOccurrenceStatus.Upcoming} | ${0}
    `(
      'is $status ($daysOverdue days overdue) when performed on $performedOn, today $today',
      ({ performedOn, today, status, daysOverdue }) => {
        const executions = performedOn
          ? [executed('2026-07-08', performedOn as string)]
          : [];
        const sut = occurrencesOf('2026-07-01', 7, executions);

        const occurrence = sut.occurrenceOn(
          date('2026-07-08'),
          date(today as string),
        );

        expect(occurrence.status).toBe(status);
        expect(occurrence.daysOverdue).toBe(daysOverdue);
      },
    );

    it('carries the execution that covers it', () => {
      const execution = executed('2026-07-08', '2026-07-08');
      const sut = occurrencesOf('2026-07-01', 7, [execution]);

      expect(
        sut.occurrenceOn(date('2026-07-08'), date('2026-07-10')).execution,
      ).toBe(execution);
      expect(
        sut.occurrenceOn(date('2026-07-01'), date('2026-07-10')).execution,
      ).toBeNull();
    });
  });

  describe('the next due date — the occurrence an execution recorded today is for', () => {
    it('is the first due date when recorded before it (06/29 for 07/01)', () => {
      expect(
        occurrencesOf('2026-07-01', 7)
          .nextDueDate(date('2026-06-29'))
          .asString(),
      ).toBe('2026-07-01');
    });

    it('is the current occurrence, leaving an earlier unexecuted one missed (07/08 for first due 07/01)', () => {
      const sut = occurrencesOf('2026-07-01', 7);

      expect(sut.nextDueDate(date('2026-07-08')).asString()).toBe('2026-07-08');
      expect(
        sut.occurrenceOn(date('2026-07-01'), date('2026-07-08')).status,
      ).toBe(PmOccurrenceStatus.Missed);
    });

    it('is the current occurrence while it is overdue', () => {
      expect(
        occurrencesOf('2026-07-01', 7)
          .nextDueDate(date('2026-07-05'))
          .asString(),
      ).toBe('2026-07-01');
    });

    it('is the occurrence after the current one once that is executed', () => {
      expect(
        occurrencesOf('2026-07-08', 7, [executed('2026-07-08', '2026-07-05')])
          .nextDueDate(date('2026-07-06'))
          .asString(),
      ).toBe('2026-07-15');
    });

    it('skips every executed occurrence from the current one on', () => {
      expect(
        occurrencesOf('2026-07-01', 7, [
          executed('2026-07-01', '2026-06-29'),
          executed('2026-07-08', '2026-06-30'),
        ])
          .nextDueDate(date('2026-06-30'))
          .asString(),
      ).toBe('2026-07-15');
    });
  });

  describe('the next due date', () => {
    it('follows an early execution (first due 07/08 executed 07/05 ⇒ 07/15)', () => {
      expect(
        occurrencesOf('2026-07-08', 7, [executed('2026-07-08', '2026-07-05')])
          .nextDueDate(date('2026-07-05'))
          .asString(),
      ).toBe('2026-07-15');
    });

    it('follows a shortened interval (30 → 15 on 07/10 after due 07/01 ⇒ 07/16)', () => {
      const schedule = PmSchedule.startingOn(
        date('2026-07-01'),
        IntervalDays.of(30),
      ).withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(15));
      const sut = new PmOccurrences(schedule, [
        executed('2026-07-01', '2026-07-01'),
      ]);

      expect(sut.nextDueDate(date('2026-07-10')).asString()).toBe('2026-07-16');
    });

    it('stays on an overdue occurrence until it is executed', () => {
      expect(
        occurrencesOf('2026-07-01', 7)
          .nextDueDate(date('2026-07-03'))
          .asString(),
      ).toBe('2026-07-01');
    });
  });

  describe('the current occurrence', () => {
    it('is none before the first due date', () => {
      expect(
        occurrencesOf('2026-07-08', 7).currentOccurrence(date('2026-07-07')),
      ).toBeNull();
    });

    it('is the latest due date reached, with its status today', () => {
      const current = occurrencesOf('2026-07-01', 7).currentOccurrence(
        date('2026-07-10'),
      );

      expect(current?.dueDate.asString()).toBe('2026-07-08');
      expect(current?.status).toBe(PmOccurrenceStatus.Overdue);
      expect(current?.daysOverdue).toBe(2);
    });

    it('is done once executed (an oil change done today)', () => {
      const current = occurrencesOf('2026-07-01', 7, [
        executed('2026-07-08', '2026-07-08'),
      ]).currentOccurrence(date('2026-07-08'));

      expect(current?.status).toBe(PmOccurrenceStatus.OnTime);
    });
  });

  describe('the occurrences due in a range', () => {
    it('holds every due date in it with its status today, the future ones included', () => {
      const sut = occurrencesOf('2026-07-01', 7);

      expect(
        rows(
          sut.occurrencesDueIn(
            range('2026-07-01', '2026-07-30'),
            date('2026-07-10'),
          ),
        ),
      ).toEqual([
        ['2026-07-01', PmOccurrenceStatus.Missed],
        ['2026-07-08', PmOccurrenceStatus.Overdue],
        ['2026-07-15', PmOccurrenceStatus.Upcoming],
        ['2026-07-22', PmOccurrenceStatus.Upcoming],
        ['2026-07-29', PmOccurrenceStatus.Upcoming],
      ]);
    });

    it('includes a due date on either bound', () => {
      const sut = occurrencesOf('2026-07-01', 7);

      expect(
        sut
          .occurrencesDueIn(
            range('2026-07-08', '2026-07-22'),
            date('2026-07-10'),
          )
          .map((occurrence) => occurrence.dueDate.asString()),
      ).toEqual(['2026-07-08', '2026-07-15', '2026-07-22']);
    });

    it('is empty before the first due date', () => {
      expect(
        occurrencesOf('2026-07-08', 7).occurrencesDueIn(
          range('2026-07-01', '2026-07-07'),
          date('2026-07-10'),
        ),
      ).toEqual([]);
    });

    it('judges its last occurrence against the due date after the range', () => {
      const sut = occurrencesOf('2026-07-01', 7);
      const lastOf = (today: string) =>
        sut
          .occurrencesDueIn(range('2026-07-01', '2026-07-08'), date(today))
          .at(-1)?.status;

      expect(lastOf('2026-07-14')).toBe(PmOccurrenceStatus.Overdue);
      expect(lastOf('2026-07-15')).toBe(PmOccurrenceStatus.Missed);
    });

    it('keeps the past occurrences of a changed interval as they were', () => {
      const schedule = PmSchedule.startingOn(
        date('2026-07-01'),
        IntervalDays.of(7),
      ).withIntervalChangedFrom(date('2026-07-15'), IntervalDays.of(10));
      const sut = new PmOccurrences(schedule, [
        executed('2026-07-01', '2026-07-01'),
        executed('2026-07-15', '2026-07-16'),
      ]);

      expect(
        rows(
          sut.occurrencesDueIn(
            range('2026-07-01', '2026-08-04'),
            date('2026-07-26'),
          ),
        ),
      ).toEqual([
        ['2026-07-01', PmOccurrenceStatus.OnTime],
        ['2026-07-08', PmOccurrenceStatus.Missed],
        ['2026-07-15', PmOccurrenceStatus.Late],
        ['2026-07-25', PmOccurrenceStatus.Overdue],
        ['2026-08-04', PmOccurrenceStatus.Upcoming],
      ]);
    });

    describe('up to the day the item stopped', () => {
      it('ends at the last due date before it, judged as ever (stopped 07/10)', () => {
        expect(stoppedOn('2026-07-10')).toEqual([
          ['2026-07-01', PmOccurrenceStatus.OnTime],
          ['2026-07-08', PmOccurrenceStatus.Missed],
        ]);
      });

      it('includes a due date on the day itself (stopped 07/08)', () => {
        expect(stoppedOn('2026-07-08')).toEqual([
          ['2026-07-01', PmOccurrenceStatus.OnTime],
          ['2026-07-08', PmOccurrenceStatus.Missed],
        ]);
      });

      it('leaves out the due date after it (stopped 07/07)', () => {
        expect(stoppedOn('2026-07-07')).toEqual([
          ['2026-07-01', PmOccurrenceStatus.OnTime],
        ]);
      });

      it('holds nothing in a range that opens after it', () => {
        expect(
          occurrencesOf('2026-07-01', 7, [], '2026-07-10').occurrencesDueIn(
            range('2026-07-11', '2026-07-30'),
            date('2026-07-20'),
          ),
        ).toEqual([]);
      });
    });
  });

  describe('whether an occurrence awaits recording — what an execution recorded today would cover, its day reached', () => {
    it.each([
      ['an overdue one', '2026-07-01', '2026-07-05', true],
      ['one due today', '2026-07-08', '2026-07-08', true],
      ['the next one while still ahead', '2026-07-08', '2026-07-05', false],
      ['a missed one', '2026-07-01', '2026-07-10', false],
    ])('%s (due %s, today %s): %p', (_label, dueDate, today, awaits) => {
      expect(
        occurrencesOf('2026-07-01', 7).awaitsRecording(
          date(dueDate),
          date(today),
        ),
      ).toBe(awaits);
    });

    it('is not a done one', () => {
      expect(
        occurrencesOf('2026-07-01', 7, [
          executed('2026-07-01', '2026-07-03'),
        ]).awaitsRecording(date('2026-07-01'), date('2026-07-05')),
      ).toBe(false);
    });

    it('is none of a stopped item', () => {
      expect(
        occurrencesOf('2026-07-01', 7, [], '2026-07-03').awaitsRecording(
          date('2026-07-01'),
          date('2026-07-05'),
        ),
      ).toBe(false);
    });
  });

  describe('the day an occurrence turned missed', () => {
    it('is the schedule’s next due date after it', () => {
      expect(
        missedOnOf(
          occurrencesOf('2026-07-01', 7),
          '2026-07-01',
          '2026-07-10',
        )?.asString(),
      ).toBe('2026-07-08');
    });

    it('is the next due date even after the item stopped, which no longer generates it', () => {
      expect(
        missedOnOf(
          occurrencesOf('2026-07-01', 7, [], '2026-07-03'),
          '2026-07-01',
          '2026-07-20',
        )?.asString(),
      ).toBe('2026-07-08');
    });

    it.each([
      ['done', [executed('2026-07-01', '2026-07-03')], '2026-07-20'],
      ['still overdue', [], '2026-07-07'],
      ['due today', [], '2026-07-01'],
    ])('is null while it is not missed (%s)', (_label, executions, today) => {
      expect(
        missedOnOf(
          occurrencesOf('2026-07-01', 7, executions),
          '2026-07-01',
          today,
        ),
      ).toBeNull();
    });

    it('is carried by the range reads, judged against the next due date in the range', () => {
      const [first] = occurrencesOf('2026-07-01', 7).occurrencesDueIn(
        range('2026-07-01', '2026-07-30'),
        date('2026-07-20'),
      );

      expect(first.missedOn?.asString()).toBe('2026-07-08');
    });
  });

  describe('a plan item that stopped (deactivated, or its equipment retired, on 07/10)', () => {
    it('falls in its last occurrence before the stop, however much later today is', () => {
      expect(
        stopped().currentOccurrence(date('2026-07-20'))?.dueDate.asString(),
      ).toBe('2026-07-08');
    });

    it('has the occurrences up to the stop and none after it', () => {
      expect(
        stopped().occurrenceOn(date('2026-07-08'), date('2026-07-20')).status,
      ).toBe(PmOccurrenceStatus.Missed);
      expect(() =>
        stopped().occurrenceOn(date('2026-07-15'), date('2026-07-20')),
      ).toThrow();
    });

    it('takes no more work: it has no next due date, nor a place for an interval change', () => {
      expect(() => stopped().nextDueDate(date('2026-07-09'))).toThrow();
      expect(() => stopped().intervalChangeStart(date('2026-07-09'))).toThrow();
    });
  });

  describe('where an occurrence sits in the calendar', () => {
    it('is the day it was done, when done late', () => {
      expect(calendarDateOf('2026-07-08', '2026-07-10')).toBe('2026-07-10');
    });

    it('is its due date when done on time, even early', () => {
      expect(calendarDateOf('2026-07-08', '2026-07-08')).toBe('2026-07-08');
      expect(calendarDateOf('2026-07-08', '2026-07-06')).toBe('2026-07-08');
    });

    it('is its due date while not done', () => {
      expect(calendarDateOf('2026-07-08', null)).toBe('2026-07-08');
    });
  });

  describe('the occurrences placed in a calendar range', () => {
    it('holds a late occurrence once, on the day it was done', () => {
      expect(placed('2026-07-01', '2026-07-31')).toEqual([
        ['2026-07-08', '2026-07-10', PmOccurrenceStatus.Late],
        ['2026-07-15', '2026-07-15', PmOccurrenceStatus.Upcoming],
        ['2026-07-22', '2026-07-22', PmOccurrenceStatus.Upcoming],
        ['2026-07-29', '2026-07-29', PmOccurrenceStatus.Upcoming],
      ]);
    });

    it('holds a late occurrence due before the range and done inside it', () => {
      expect(placed('2026-07-09', '2026-07-14')).toEqual([
        ['2026-07-08', '2026-07-10', PmOccurrenceStatus.Late],
      ]);
    });

    it('leaves out a late occurrence due inside the range and done after it', () => {
      expect(placed('2026-07-01', '2026-07-09')).toEqual([]);
    });

    it('keeps an occurrence not done on its due date', () => {
      expect(
        occurrencesOf('2026-07-08', 7)
          .occurrencesPlacedIn(
            range('2026-07-01', '2026-07-16'),
            date('2026-07-20'),
          )
          .map((occurrence) => [
            occurrence.calendarDate.asString(),
            occurrence.status,
          ]),
      ).toEqual([
        ['2026-07-08', PmOccurrenceStatus.Missed],
        ['2026-07-15', PmOccurrenceStatus.Overdue],
      ]);
    });

    it('ends on the day the item stopped', () => {
      expect(placed('2026-07-01', '2026-07-31', '2026-07-15')).toEqual([
        ['2026-07-08', '2026-07-10', PmOccurrenceStatus.Late],
        ['2026-07-15', '2026-07-15', PmOccurrenceStatus.Upcoming],
      ]);
    });

    // Due 07/01 every 30 days, done late on 07/11, and the interval changed
    // to 3 the same day — from 07/01, the current occurrence, so the due
    // dates become 07/01, 07/04, 07/07, 07/10, 07/13…: the late job now
    // falls after several later due dates, not before the next one.
    it('holds a late occurrence done after due dates an interval change put after it', () => {
      const schedule = PmSchedule.startingOn(
        date('2026-07-01'),
        IntervalDays.of(30),
      ).withIntervalChangedFrom(date('2026-07-01'), IntervalDays.of(3));
      const sut = new PmOccurrences(schedule, [
        executed('2026-07-01', '2026-07-11'),
      ]);

      expect(
        sut
          .occurrencesPlacedIn(
            range('2026-07-11', '2026-07-14'),
            date('2026-07-11'),
          )
          .map((occurrence) => [
            occurrence.dueDate.asString(),
            occurrence.calendarDate.asString(),
            occurrence.status,
          ]),
      ).toEqual([
        ['2026-07-01', '2026-07-11', PmOccurrenceStatus.Late],
        ['2026-07-13', '2026-07-13', PmOccurrenceStatus.Upcoming],
      ]);
    });
  });

  // Issue #114: the equipment history lists these beside its executions.
  describe('the occurrences missed by today', () => {
    it('lists each one separately, oldest first, leaving out the one still overdue (today 07/16: 07/01, 07/08)', () => {
      expect(
        missedDueDates(occurrencesOf('2026-07-01', 7), '2026-07-16'),
      ).toEqual(['2026-07-01', '2026-07-08']);
    });

    it.each(['2026-06-20', '2026-07-01', '2026-07-05', '2026-07-07'])(
      'is none before the next due date is reached (today %s)',
      (today) => {
        expect(missedDueDates(occurrencesOf('2026-07-01', 7), today)).toEqual(
          [],
        );
      },
    );

    it('holds an occurrence from the day the next one falls due (today 07/08: 07/01)', () => {
      expect(
        missedDueDates(occurrencesOf('2026-07-01', 7), '2026-07-08'),
      ).toEqual(['2026-07-01']);
    });

    it('leaves out the occurrences done, on time or late', () => {
      expect(
        missedDueDates(
          occurrencesOf('2026-07-01', 7, [
            executed('2026-07-01', '2026-07-01'),
            executed('2026-07-15', '2026-07-17'),
          ]),
          '2026-07-30',
        ),
      ).toEqual(['2026-07-08', '2026-07-22']);
    });

    it('stops on the day the item was deactivated, judging the last one against the schedule (deactivated 07/20, today 07/30)', () => {
      expect(
        missedDueDates(
          occurrencesOf('2026-07-01', 7, [], '2026-07-20'),
          '2026-07-30',
        ),
      ).toEqual(['2026-07-01', '2026-07-08', '2026-07-15']);
    });

    describe('in a range, by due date', () => {
      it('holds only those due in it (07/05–07/10, today 07/16: 07/08)', () => {
        expect(
          missedDueDates(occurrencesOf('2026-07-01', 7), '2026-07-16', [
            '2026-07-05',
            '2026-07-10',
          ]),
        ).toEqual(['2026-07-08']);
      });

      it('judges its last one against the next due date beyond it (07/08–07/08, today 07/16)', () => {
        expect(
          missedDueDates(occurrencesOf('2026-07-01', 7), '2026-07-16', [
            '2026-07-08',
            '2026-07-08',
          ]),
        ).toEqual(['2026-07-08']);
      });

      it('holds nothing past today, however far it reaches (07/01–08/30, today 07/16)', () => {
        expect(
          missedDueDates(occurrencesOf('2026-07-01', 7), '2026-07-16', [
            '2026-07-01',
            '2026-08-30',
          ]),
        ).toEqual(['2026-07-01', '2026-07-08']);
      });

      it.each([
        ['before the first due date', ['2026-06-01', '2026-06-30']],
        ['after today', ['2026-07-17', '2026-07-31']],
      ] as const)('holds nothing when it lies %s', (_label, within) => {
        expect(
          missedDueDates(occurrencesOf('2026-07-01', 7), '2026-07-16', [
            ...within,
          ]),
        ).toEqual([]);
      });
    });
  });

  it('refuses two executions of one due date', () => {
    expect(() =>
      occurrencesOf('2026-07-01', 7, [
        executed('2026-07-01', '2026-07-01'),
        executed('2026-07-01', '2026-07-02'),
      ]),
    ).toThrow();
  });

  describe('where an interval changed today takes effect', () => {
    it('is the current occurrence when nothing later is done', () => {
      expect(
        occurrencesOf('2026-07-01', 30, [executed('2026-07-01', '2026-07-01')])
          .intervalChangeStart(date('2026-07-10'))
          .asString(),
      ).toBe('2026-07-01');
    });

    it('is the first due date while that is still ahead', () => {
      expect(
        occurrencesOf('2026-07-08', 7)
          .intervalChangeStart(date('2026-07-01'))
          .asString(),
      ).toBe('2026-07-08');
    });

    it('is the latest occurrence already done, when that is ahead of today (done 07/01 and early for 07/31)', () => {
      expect(
        occurrencesOf('2026-07-01', 30, [
          executed('2026-07-01', '2026-07-01'),
          executed('2026-07-31', '2026-07-02'),
        ])
          .intervalChangeStart(date('2026-07-05'))
          .asString(),
      ).toBe('2026-07-31');
    });
  });
});

// Issue #110: the design's worked example. Every 7 days from 2026-09-23
// (Jalali 1405/07/01); the equipment retired on 07/10 and reactivated on
// 07/20, retired again on 08/05 and reactivated on 08/18. Due dates from the
// day after a retirement day up to, not including, its reactivation day are
// not generated; the retirement day itself stays in service.
describe('PmOccurrences — an equipment out of service in between (issue #110)', () => {
  const firstGap = ServiceGap.between(date('2026-10-03'), date('2026-10-12'));
  const secondGap = ServiceGap.between(date('2026-10-28'), date('2026-11-09'));

  function outOfService(
    executions: MaintenanceExecution[],
    gaps: ServiceGap[] = [firstGap, secondGap],
  ) {
    return new PmOccurrences(
      PmSchedule.startingOn(date('2026-09-23'), IntervalDays.of(7)),
      executions,
      null,
      gaps,
    );
  }

  it('leaves the due dates of every gap out of a range, judging the one before a gap against the schedule’s next due date (80%: 07/08 missed; 07/15, 08/06, 08/13 out)', () => {
    const occurrences = outOfService([
      executed('2026-09-23', '2026-09-23'),
      executed('2026-10-14', '2026-10-14'),
      executed('2026-10-21', '2026-10-21'),
      executed('2026-11-11', '2026-11-11'),
    ]);

    expect(
      rows(
        occurrences.occurrencesDueIn(
          range('2026-09-23', '2026-11-15'),
          date('2026-11-16'),
        ),
      ),
    ).toEqual([
      ['2026-09-23', PmOccurrenceStatus.OnTime],
      ['2026-09-30', PmOccurrenceStatus.Missed],
      ['2026-10-14', PmOccurrenceStatus.OnTime],
      ['2026-10-21', PmOccurrenceStatus.OnTime],
      ['2026-11-11', PmOccurrenceStatus.OnTime],
    ]);
    expect(
      missedOnOf(occurrences, '2026-09-30', '2026-11-16')?.asString(),
    ).toBe('2026-10-07');
  });

  it('has the first due date after the gap as next on the reactivation day (07/22)', () => {
    expect(
      outOfService([executed('2026-09-23', '2026-09-23')], [firstGap])
        .nextDueDate(date('2026-10-12'))
        .asString(),
    ).toBe('2026-10-14');
  });

  it('never makes an occurrence before a gap the one to record, even before it turned missed', () => {
    // Retired 07/10, reactivated 07/12: 07/08 is undone and its next due
    // date, 07/15, still ahead.
    const shortGap = ServiceGap.between(date('2026-10-03'), date('2026-10-04'));
    const occurrences = outOfService([], [shortGap]);

    expect(occurrences.nextDueDate(date('2026-10-04')).asString()).toBe(
      '2026-10-07',
    );
    expect(
      occurrences.awaitsRecording(date('2026-09-30'), date('2026-10-04')),
    ).toBe(false);
  });

  it('has no current occurrence between the reactivation day and the first due date after it', () => {
    expect(
      outOfService([], [firstGap]).currentOccurrence(date('2026-10-13')),
    ).toBeNull();
    expect(
      outOfService([], [firstGap])
        .currentOccurrence(date('2026-10-15'))
        ?.dueDate.asString(),
    ).toBe('2026-10-14');
  });

  it('has no occurrence on a due date inside a gap', () => {
    const occurrences = outOfService([]);

    expect(occurrences.generatesOn(date('2026-10-07'))).toBe(false);
    expect(occurrences.generatesOn(date('2026-10-14'))).toBe(true);
    expect(() =>
      occurrences.occurrenceOn(date('2026-10-07'), date('2026-11-16')),
    ).toThrow();
  });

  it('skips a gap when the work moves on (07/22 done early on the reactivation day ⇒ 07/29)', () => {
    expect(
      outOfService(
        [
          executed('2026-09-30', '2026-09-30'),
          executed('2026-10-14', '2026-10-12'),
        ],
        [firstGap],
      )
        .nextDueDate(date('2026-10-12'))
        .asString(),
    ).toBe('2026-10-21');
  });

  it('takes an interval change from the first due date after the gap', () => {
    expect(
      outOfService([], [firstGap])
        .intervalChangeStart(date('2026-10-12'))
        .asString(),
    ).toBe('2026-10-14');
  });

  // Reviewer L2: recorded work is never dropped. 07/15 done early on 07/09,
  // before the retirement on 07/10, still counts.
  it('keeps a due date inside a gap that was done anyway', () => {
    const occurrences = outOfService(
      [executed('2026-10-07', '2026-10-01')],
      [firstGap],
    );

    expect(occurrences.generatesOn(date('2026-10-07'))).toBe(true);
    expect(
      rows(
        occurrences.occurrencesDueIn(
          range('2026-10-01', '2026-10-14'),
          date('2026-10-18'),
        ),
      ),
    ).toEqual([
      ['2026-10-07', PmOccurrenceStatus.OnTime],
      ['2026-10-14', PmOccurrenceStatus.Overdue],
    ]);
  });

  it('misses none of the due dates inside a gap, but the one before it by the schedule’s next due date (done 07/01, out 07/11–07/19, today 07/20: 07/08)', () => {
    expect(
      outOfService([executed('2026-09-23', '2026-09-23')], [firstGap])
        .occurrencesMissedIn(null, date('2026-10-12'))
        .map((occurrence) => occurrence.dueDate.asString()),
    ).toEqual(['2026-09-30']);
  });

  // Retired 07/10, not reactivated.
  function retired(executions: MaintenanceExecution[]) {
    return outOfService(executions, [ServiceGap.from(date('2026-10-03'))]);
  }

  describe('while still retired (an open gap)', () => {
    it('generates nothing after the retirement day, judging the last one before against the schedule', () => {
      expect(
        rows(
          retired([]).occurrencesDueIn(
            range('2026-09-23', '2026-10-31'),
            date('2026-10-17'),
          ),
        ),
      ).toEqual([
        ['2026-09-23', PmOccurrenceStatus.Missed],
        ['2026-09-30', PmOccurrenceStatus.Missed],
      ]);
    });

    it('keeps a job done for a later due date before the retirement', () => {
      expect(
        rows(
          retired([executed('2026-10-07', '2026-10-01')]).occurrencesDueIn(
            range('2026-09-30', '2026-10-31'),
            date('2026-10-17'),
          ),
        ),
      ).toEqual([
        ['2026-09-30', PmOccurrenceStatus.Missed],
        ['2026-10-07', PmOccurrenceStatus.OnTime],
      ]);
    });

    it('falls in its last occurrence before the retirement', () => {
      expect(
        retired([]).currentOccurrence(date('2026-10-17'))?.dueDate.asString(),
      ).toBe('2026-09-30');
    });

    it('takes no more work and awaits no recording', () => {
      const occurrences = retired([]);

      expect(() => occurrences.nextDueDate(date('2026-10-17'))).toThrow();
      expect(
        occurrences.awaitsRecording(date('2026-09-30'), date('2026-10-01')),
      ).toBe(false);
    });
  });
});
