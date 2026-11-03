import { Identity } from '@framework/domain';

import { MaintenanceExecution } from './maintenance-execution.aggregate';
import { PmOccurrences } from './pm-occurrences';
import { PmPerformance } from './pm-performance';
import { CalendarDate } from './value/calendar-date.vo';
import { IntervalDays } from './value/interval-days.vo';
import { PmDashboardPeriod } from './value/pm-dashboard-period.vo';
import { PmSchedule } from './value/pm-schedule.vo';

// The issue's dates are Jalali; these are their Gregorian days. 1405/07/01 is
// 2026-09-23, so 07/dd is September 22 + dd up to 07/08, then October dd − 8.
const J = {
  '07/01': '2026-09-23',
  '07/08': '2026-09-30',
  '07/10': '2026-10-02',
  '07/13': '2026-10-05',
  '07/14': '2026-10-06',
  '07/15': '2026-10-07',
  '07/19': '2026-10-11',
  '07/20': '2026-10-12',
  '07/22': '2026-10-14',
  '07/30': '2026-10-22',
} as const;

const date = (value: string) => CalendarDate.fromString(value);

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

/**
 * The performance of one plan item over the past days of a `periodDays`
 * period ending `today`.
 */
function performanceOf(
  firstDueDate: string,
  intervalDays: number,
  executions: MaintenanceExecution[],
  today: string,
  periodDays: number,
): PmPerformance {
  const period = PmDashboardPeriod.endingOn(date(today), periodDays);
  const occurrences = new PmOccurrences(
    PmSchedule.startingOn(date(firstDueDate), IntervalDays.of(intervalDays)),
    executions,
  ).occurrencesDueIn(period.followUpWindow(), date(today));
  return PmPerformance.of(occurrences, period.pastDays());
}

const summary = (performance: PmPerformance) => ({
  considered: performance.considered(),
  onTime: performance.onTime(),
  late: performance.late(),
  notDone: performance.notDone(),
  adherencePercent: performance.adherencePercent(),
  completionPercent: performance.completionPercent(),
  averageDaysLate: performance.averageDaysLate(),
});

describe('PmPerformance', () => {
  it('judges a weekly oil change: two on time, two late by 2 and 4 days, one not done', () => {
    const sut = performanceOf(
      J['07/01'],
      7,
      [
        executed(J['07/01'], J['07/01']),
        executed(J['07/08'], J['07/10']),
        executed(J['07/15'], J['07/19']),
        executed(J['07/22'], J['07/22']),
      ],
      J['07/30'],
      30,
    );

    expect(summary(sut)).toEqual({
      considered: 5,
      onTime: 2,
      late: 2,
      notDone: 1,
      adherencePercent: 40,
      completionPercent: 80,
      averageDaysLate: 3,
    });
  });

  it('counts overdue and missed occurrences as not done', () => {
    const sut = performanceOf(J['07/01'], 7, [], J['07/10'], 30);

    expect([sut.considered(), sut.notDone(), sut.adherencePercent()]).toEqual([
      2, 2, 0,
    ]);
  });

  it('has no percentages without a past occurrence — not enough data', () => {
    const sut = performanceOf(J['07/13'], 30, [], J['07/20'], 7);

    expect(summary(sut)).toEqual({
      considered: 0,
      onTime: 0,
      late: 0,
      notDone: 0,
      adherencePercent: null,
      completionPercent: null,
      averageDaysLate: null,
    });
  });

  it('judges an occurrence due on the period’s first day (07/14 in 07/14 – 07/20) as not done: 0%', () => {
    const sut = performanceOf(J['07/14'], 30, [], J['07/20'], 7);

    expect([sut.adherencePercent(), sut.completionPercent()]).toEqual([0, 0]);
  });

  it('leaves out today’s occurrences, even one already done', () => {
    const sut = performanceOf(
      J['07/20'],
      30,
      [executed(J['07/20'], J['07/20'])],
      J['07/20'],
      7,
    );

    expect(sut.considered()).toBe(0);
  });

  it('rounds its percentages to whole numbers', () => {
    const sut = performanceOf(
      J['07/01'],
      7,
      [executed(J['07/01'], J['07/01']), executed(J['07/08'], J['07/08'])],
      J['07/19'],
      30,
    );

    expect([sut.considered(), sut.adherencePercent()]).toEqual([3, 67]);
  });

  it('averages the days late to one decimal', () => {
    const sut = performanceOf(
      J['07/01'],
      7,
      [
        executed(J['07/01'], '2026-09-24'),
        executed(J['07/08'], J['07/10']),
        executed(J['07/15'], '2026-10-09'),
      ],
      J['07/20'],
      30,
    );

    expect([sut.late(), sut.averageDaysLate()]).toEqual([3, 1.7]);
  });

  it('has no average days late when nothing was late', () => {
    const sut = performanceOf(
      J['07/01'],
      7,
      [executed(J['07/01'], J['07/01'])],
      J['07/08'],
      30,
    );

    expect([sut.considered(), sut.averageDaysLate()]).toEqual([1, null]);
  });
});
