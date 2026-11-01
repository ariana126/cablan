import { ValueObject } from '@framework/domain';

import { ExecutedOccurrence, PmOccurrence } from '../pm-occurrences';
import { CalendarDate } from './calendar-date.vo';
import { CalendarDateRange } from './calendar-date-range.vo';
import { PmOccurrenceStatus } from './pm-occurrence-status';
import { PmSchedule } from './pm-schedule.vo';

/** The periods the technical management dashboard looks back over. */
export const PM_DASHBOARD_PERIOD_DAYS = [7, 30, 90] as const;

export type PmDashboardPeriodDays = (typeof PM_DASHBOARD_PERIOD_DAYS)[number];

const WEEK = 7;

/**
 * The days the technical management dashboard looks back over: the last 7,
 * 30 or 90, today included. Performance is judged on its past days only —
 * today's occurrences are still open — and the follow-up reaches a week
 * ahead. The design: docs/superpowers/specs/2026-11-01-technical-management-dashboard-design.md.
 */
export class PmDashboardPeriod extends ValueObject {
  private constructor(
    readonly today: CalendarDate,
    readonly from: CalendarDate,
  ) {
    super();
  }

  static endingOn(today: CalendarDate, days: number): PmDashboardPeriod {
    if (!(PM_DASHBOARD_PERIOD_DAYS as readonly number[]).includes(days)) {
      throw new Error(
        `A PM dashboard period is ${PM_DASHBOARD_PERIOD_DAYS.join(', ')} days, not ${days}`,
      );
    }
    return new PmDashboardPeriod(today, today.plusDays(-(days - 1)));
  }

  /** How many days it holds, today included. */
  days(): number {
    return this.range().days();
  }

  /** From its first day through today. */
  range(): CalendarDateRange {
    return CalendarDateRange.between(this.from, this.today);
  }

  /** From its first day through yesterday — the days performance is judged on. */
  pastDays(): CalendarDateRange {
    return CalendarDateRange.between(this.from, this.yesterday());
  }

  /** Tomorrow through a week from today. */
  nextSevenDays(): CalendarDateRange {
    return CalendarDateRange.between(
      this.today.plusDays(1),
      this.today.plusDays(WEEK),
    );
  }

  /** From its first day through a week from today — what the follow-up table holds. */
  followUpWindow(): CalendarDateRange {
    return CalendarDateRange.between(this.from, this.today.plusDays(WEEK));
  }

  /**
   * The due dates a plan item on `schedule` is read over: from its due date
   * just before the period — the only earlier occurrence that can still be
   * overdue, or turn missed inside it — or the period's first day when it has
   * none, through the follow-up window's end.
   */
  dueDateWindowOf(schedule: PmSchedule): CalendarDateRange {
    const followUp = this.followUpWindow();
    const before = schedule.latestDueDateOnOrBefore(this.from.plusDays(-1));
    return CalendarDateRange.between(before ?? followUp.from, followUp.to);
  }

  /** Whether `occurrence` turned missed on one of its days. */
  sawTurnMissed(occurrence: PmOccurrence<ExecutedOccurrence>): boolean {
    return (
      occurrence.missedOn !== null && this.range().contains(occurrence.missedOn)
    );
  }

  /**
   * Whether it follows up `occurrence`, one of a plan item's in its due-date
   * window: every one due from its first day on, and the one before it only
   * while overdue or once it turned missed inside it.
   */
  followsUp(occurrence: PmOccurrence<ExecutedOccurrence>): boolean {
    return (
      !occurrence.dueDate.isBefore(this.from) ||
      occurrence.status === PmOccurrenceStatus.Overdue ||
      this.sawTurnMissed(occurrence)
    );
  }

  /** Each past day on its own, oldest first. */
  dailyBuckets(): CalendarDateRange[] {
    const buckets: CalendarDateRange[] = [];
    for (let day = this.from; !day.isAfter(this.yesterday()); ) {
      buckets.push(CalendarDateRange.between(day, day));
      day = day.plusDays(1);
    }
    return buckets;
  }

  /**
   * The past days in weeks counted back from yesterday, oldest first; the
   * oldest is cut short at the period's first day.
   */
  weeklyBuckets(): CalendarDateRange[] {
    const buckets: CalendarDateRange[] = [];
    for (let to = this.yesterday(); !to.isBefore(this.from); ) {
      const from = to.plusDays(-(WEEK - 1));
      buckets.unshift(
        CalendarDateRange.between(
          from.isBefore(this.from) ? this.from : from,
          to,
        ),
      );
      to = to.plusDays(-WEEK);
    }
    return buckets;
  }

  private yesterday(): CalendarDate {
    return this.today.plusDays(-1);
  }
}
