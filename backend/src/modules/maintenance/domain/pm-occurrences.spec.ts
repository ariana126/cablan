import { Identity } from '@framework/domain';

import { MaintenanceExecution } from './maintenance-execution.aggregate';
import { PmOccurrences } from './pm-occurrences';
import { CalendarDate } from './value/calendar-date.vo';
import { IntervalDays } from './value/interval-days.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { PmSchedule } from './value/pm-schedule.vo';

const date = (value: string) => CalendarDate.fromString(value);

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
  });
}

function occurrencesOf(
  firstDueDate: string,
  intervalDays: number,
  executions: MaintenanceExecution[] = [],
) {
  return new PmOccurrences(
    PmSchedule.startingOn(date(firstDueDate), IntervalDays.of(intervalDays)),
    executions,
  );
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

  describe('every occurrence so far', () => {
    it('runs from the first due date through the next one not yet reached', () => {
      const sut = occurrencesOf('2026-07-01', 7, [
        executed('2026-07-08', '2026-07-09'),
      ]);

      expect(
        sut
          .occurrencesThrough(date('2026-07-16'))
          .map((occurrence) => [
            occurrence.dueDate.asString(),
            occurrence.status,
          ]),
      ).toEqual([
        ['2026-07-01', PmOccurrenceStatus.Missed],
        ['2026-07-08', PmOccurrenceStatus.Late],
        ['2026-07-15', PmOccurrenceStatus.Overdue],
        ['2026-07-22', PmOccurrenceStatus.Upcoming],
      ]);
    });

    it('is only the first, upcoming, before the first due date', () => {
      expect(
        occurrencesOf('2026-07-08', 7)
          .occurrencesThrough(date('2026-07-01'))
          .map((occurrence) => [
            occurrence.dueDate.asString(),
            occurrence.status,
          ]),
      ).toEqual([['2026-07-08', PmOccurrenceStatus.Upcoming]]);
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
        sut
          .occurrencesThrough(date('2026-07-26'))
          .map((occurrence) => [
            occurrence.dueDate.asString(),
            occurrence.status,
          ]),
      ).toEqual([
        ['2026-07-01', PmOccurrenceStatus.OnTime],
        ['2026-07-08', PmOccurrenceStatus.Missed],
        ['2026-07-15', PmOccurrenceStatus.Late],
        ['2026-07-25', PmOccurrenceStatus.Overdue],
        ['2026-08-04', PmOccurrenceStatus.Upcoming],
      ]);
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
