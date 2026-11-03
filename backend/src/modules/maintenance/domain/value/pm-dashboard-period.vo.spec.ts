import { Identity } from '@framework/domain';

import { MaintenanceExecution } from '../maintenance-execution.aggregate';
import { PmOccurrences } from '../pm-occurrences';
import { CalendarDate } from './calendar-date.vo';
import { CalendarDateRange } from './calendar-date-range.vo';
import { IntervalDays } from './interval-days.vo';
import { PmDashboardPeriod } from './pm-dashboard-period.vo';
import { PmSchedule } from './pm-schedule.vo';

const date = (value: string) => CalendarDate.fromString(value);
const bounds = (range: CalendarDateRange) => [
  range.from.asString(),
  range.to.asString(),
];
const weeklyFrom = (firstDueDate: string) =>
  PmSchedule.startingOn(date(firstDueDate), IntervalDays.of(7));

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
 * Whether the 7-day period ending 07/10 (07/04 – 07/10) follows up the
 * occurrence due `dueDate` of a weekly plan from 07/01.
 */
function followedUp(dueDate: string, executions: MaintenanceExecution[] = []) {
  const today = date('2026-10-02');
  const occurrence = new PmOccurrences(
    weeklyFrom('2026-09-23'),
    executions,
  ).occurrenceOn(date(dueDate), today);
  return PmDashboardPeriod.endingOn(today, 7).followsUp(occurrence);
}

// The issue's dates are Jalali: 1405/07/01 is 2026-09-23, 1405/07/14 is
// 2026-10-06, 1405/07/20 is 2026-10-12 and 1405/07/30 is 2026-10-22.
describe('PmDashboardPeriod', () => {
  it('spans the last 30 days, today included (07/01 – 07/30)', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-22'), 30);

    expect(bounds(sut.range())).toEqual(['2026-09-23', '2026-10-22']);
  });

  it('spans the last 7 days, today included (07/14 – 07/20)', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-12'), 7);

    expect(bounds(sut.range())).toEqual(['2026-10-06', '2026-10-12']);
  });

  it('spans the last 90 days, today included', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-22'), 90);

    expect(bounds(sut.range())).toEqual(['2026-07-25', '2026-10-22']);
  });

  it.each([0, 1, 14, 31, 365])('is never %p days long', (days) => {
    expect(() => PmDashboardPeriod.endingOn(date('2026-10-22'), days)).toThrow(
      Error,
    );
  });

  it('judges performance on its past days only, today left out', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-12'), 7);

    expect(bounds(sut.pastDays())).toEqual(['2026-10-06', '2026-10-11']);
  });

  it('looks ahead over the next seven days, today left out', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-12'), 7);

    expect(bounds(sut.nextSevenDays())).toEqual(['2026-10-13', '2026-10-19']);
  });

  it('follows up from its first day through the next seven days', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-12'), 30);

    expect(bounds(sut.followUpWindow())).toEqual(['2026-09-13', '2026-10-19']);
  });

  it('trends daily over each of its past days, oldest first', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-12'), 7);

    expect(sut.dailyBuckets().map((range) => bounds(range))).toEqual([
      ['2026-10-06', '2026-10-06'],
      ['2026-10-07', '2026-10-07'],
      ['2026-10-08', '2026-10-08'],
      ['2026-10-09', '2026-10-09'],
      ['2026-10-10', '2026-10-10'],
      ['2026-10-11', '2026-10-11'],
    ]);
  });

  it('trends weekly in 7 days counted back from yesterday, the oldest clipped at its first day', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-22'), 30);

    expect(sut.weeklyBuckets().map((range) => bounds(range))).toEqual([
      ['2026-09-23', '2026-09-23'],
      ['2026-09-24', '2026-09-30'],
      ['2026-10-01', '2026-10-07'],
      ['2026-10-08', '2026-10-14'],
      ['2026-10-15', '2026-10-21'],
    ]);
  });

  it('trends a 7-day period as one shorter week', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-12'), 7);

    expect(sut.weeklyBuckets().map((range) => bounds(range))).toEqual([
      ['2026-10-06', '2026-10-11'],
    ]);
  });

  describe('the due dates a plan item is read over', () => {
    it('start at its due date just before the period — the one that may still be overdue or turn missed in it', () => {
      const sut = PmDashboardPeriod.endingOn(date('2026-10-02'), 7);

      expect(bounds(sut.dueDateWindowOf(weeklyFrom('2026-09-23')))).toEqual([
        '2026-09-23',
        '2026-10-09',
      ]);
    });

    it('start at the period’s first day for a plan first due inside it', () => {
      const sut = PmDashboardPeriod.endingOn(date('2026-10-02'), 7);

      expect(bounds(sut.dueDateWindowOf(weeklyFrom('2026-09-30')))).toEqual([
        '2026-09-26',
        '2026-10-09',
      ]);
    });
  });

  describe('whether an occurrence turned missed during it (07/04 – 07/10)', () => {
    const sut = PmDashboardPeriod.endingOn(date('2026-10-02'), 7);
    const occurrences = new PmOccurrences(weeklyFrom('2026-09-16'), []);

    it.each([
      ['06/25 → missed 07/01, before it', '2026-09-16', false],
      ['07/01 → missed 07/08, inside it', '2026-09-23', true],
      ['07/08, still overdue', '2026-09-30', false],
    ])('%s: %p', (_label, dueDate, turned) => {
      expect(
        sut.sawTurnMissed(
          occurrences.occurrenceOn(date(dueDate), date('2026-10-02')),
        ),
      ).toBe(turned);
    });
  });

  describe('which occurrences it follows up (07/04 – 07/10, a weekly plan from 07/01)', () => {
    it('follows up one due inside it, done or not', () => {
      expect(
        followedUp('2026-09-30', [executed('2026-09-30', '2026-09-30')]),
      ).toBe(true);
    });

    it('follows up one due a week ahead', () => {
      expect(followedUp('2026-10-07')).toBe(true);
    });

    it('follows up the one just before it once it turned missed inside it', () => {
      expect(followedUp('2026-09-23')).toBe(true);
    });

    it('leaves out the one just before it, done on an earlier day', () => {
      expect(
        followedUp('2026-09-23', [executed('2026-09-23', '2026-09-25')]),
      ).toBe(false);
    });

    it('follows up the one just before it while still overdue', () => {
      const today = date('2026-10-02');
      const overdue = new PmOccurrences(
        PmSchedule.startingOn(date('2026-09-25'), IntervalDays.of(30)),
        [],
      ).occurrenceOn(date('2026-09-25'), today);

      expect(PmDashboardPeriod.endingOn(today, 7).followsUp(overdue)).toBe(
        true,
      );
    });
  });
});
