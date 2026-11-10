import { CalendarDate } from './value/calendar-date.vo';
import { CalendarDateRange } from './value/calendar-date-range.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { PmSchedule } from './value/pm-schedule.vo';
import { ServiceGap } from './value/service-gap.vo';

/**
 * What the calculator needs of an execution: which occurrence it covers, the
 * Tehran date it was performed on, and whether it was on time — a judgement
 * the execution makes itself, so there is one on-time rule
 * (`MaintenanceExecution.status()`).
 */
export interface ExecutedOccurrence {
  dueDate(): CalendarDate;
  performedOn(): CalendarDate;
  status(): PmOccurrenceStatus.OnTime | PmOccurrenceStatus.Late;
  /** Whole Tehran days after its due date it was done, or `null` when on time. */
  daysLate(): number | null;
}

export interface PmOccurrence<E extends ExecutedOccurrence> {
  readonly dueDate: CalendarDate;
  /**
   * The day the calendar shows it on: the Tehran date it was performed when
   * `late`, its due date otherwise.
   */
  readonly calendarDate: CalendarDate;
  readonly status: PmOccurrenceStatus;
  /** Days since the due date while `overdue`; `0` in every other status. */
  readonly daysOverdue: number;
  /**
   * The day it turned `missed` — the schedule's next due date after it, even
   * when a stopped item no longer generates that one; `null` in every other
   * status.
   */
  readonly missedOn: CalendarDate | null;
  readonly execution: E | null;
}

/**
 * One PM plan item's occurrences against its executions — the pure
 * calculator behind the daily list, the overview, the next due date (which is
 * also the occurrence an execution is recorded for) and where an interval
 * change takes effect. Nothing missed is ever stored: every status is
 * computed here, from the schedule, the executions and today. The rules are
 * the design's (docs/superpowers/specs/2026-10-29-maintenance-management-design.md).
 *
 * Issue #110: due dates inside a `ServiceGap` — a stretch its equipment was
 * out of service, ended by a reactivation or still open — are not generated:
 * not listed, not counted, never recorded. Work recorded for one anyway
 * (done before the retirement) is never dropped: that occurrence stays. An
 * occurrence before a gap is judged as ever, against the schedule's next due
 * date even when the gap swallowed it, and once a gap has ended the current
 * occurrence is never one before it. An open gap, like a stop date, means
 * the item takes no more work.
 */
export class PmOccurrences<E extends ExecutedOccurrence> {
  private readonly executionsByDueDate: ReadonlyMap<string, E>;

  /**
   * `stopDate` is the last day the item was in force — deactivated, or its
   * equipment retired (`Equipment.stopDateOf`) — or `null` while it still
   * is. No occurrence exists after it, whatever the method asked. `gaps` are
   * its equipment's service gaps, oldest first — only the last may be open
   * (`Equipment.occurrencesOf` / `occurrencesInForceOf`).
   */
  constructor(
    private readonly schedule: PmSchedule,
    executions: readonly E[],
    private readonly stopDate: CalendarDate | null = null,
    private readonly gaps: readonly ServiceGap[] = [],
  ) {
    const byDueDate = new Map<string, E>();
    for (const execution of executions) {
      const dueDate = execution.dueDate().asString();
      if (byDueDate.has(dueDate)) {
        throw new Error(`Two executions of the occurrence due ${dueDate}`);
      }
      byDueDate.set(dueDate, execution);
    }
    this.executionsByDueDate = byDueDate;
  }

  /**
   * The occurrence falling due on `dueDate`, as it stands on `today`. There
   * is none after the stop date.
   */
  occurrenceOn(dueDate: CalendarDate, today: CalendarDate): PmOccurrence<E> {
    if (!this.generatesOn(dueDate)) {
      throw new Error(
        `No occurrence due ${dueDate.asString()}: past the item's stop date (${this.stopDate?.asString() ?? 'none'}) or out of service`,
      );
    }
    return this.occurrence(
      dueDate,
      () => this.schedule.occurrenceAfter(dueDate),
      today,
    );
  }

  /**
   * Whether a due date on `day` exists for this item: on or before its stop
   * date, and outside every service gap — or inside one but done anyway.
   */
  generatesOn(day: CalendarDate): boolean {
    return !this.isAfterStop(day) && !this.isSkipped(day);
  }

  /**
   * The occurrence `today` falls in — the latest due date reached — or
   * `null` before the first due date, or since a service gap ended before
   * the first due date after it; for a stopped item, the last one reached by
   * the stop date. The daily list shows it while it is `due` or `overdue`.
   */
  currentOccurrence(today: CalendarDate): PmOccurrence<E> | null {
    const current = this.latestReachedSinceService(this.lastDayIn(today));
    return current ? this.occurrenceOn(current, today) : null;
  }

  /**
   * The due date the plan shows as next, and the occurrence an execution
   * recorded today is for: the earliest one from the current occurrence on
   * that has no execution yet. So an occurrence already missed can never be
   * recorded, and one done early moves the work on to the next. A stopped
   * item has none.
   */
  nextDueDate(today: CalendarDate): CalendarDate {
    this.assertInForce();
    let target = this.currentDueDate(today);
    while (this.executionsByDueDate.has(target.asString())) {
      target = this.firstDueOnOrAfter(target.plusDays(1));
    }
    return target;
  }

  /**
   * Whether the occurrence due `dueDate` awaits recording: its day has come
   * and an execution recorded `today` would be for it — the same next due
   * date `Equipment.recordExecutionOf` records against. A stopped item awaits
   * nothing.
   */
  awaitsRecording(dueDate: CalendarDate, today: CalendarDate): boolean {
    return (
      this.stopDate === null &&
      !this.isOutOfServiceNow() &&
      !today.isBefore(dueDate) &&
      this.nextDueDate(today).equals(dueDate)
    );
  }

  /**
   * Where an interval changed on `today` takes effect: the current
   * occurrence — or, when an occurrence ahead of it is already done, the
   * latest one done, so no execution is left on a due date the new interval
   * no longer generates. A stopped item takes no change.
   */
  intervalChangeStart(today: CalendarDate): CalendarDate {
    this.assertInForce();
    let start = this.currentDueDate(today);
    for (const execution of this.executionsByDueDate.values()) {
      if (execution.dueDate().isAfter(start)) {
        start = execution.dueDate();
      }
    }
    return start;
  }

  /**
   * Every occurrence whose due date is in `range`, future ones included,
   * oldest first, each with its status today — the overview's rows for this
   * plan item. Nothing after the stop date is generated, while the
   * occurrences before it are judged as ever, against the schedule's next due
   * date even when that one is no longer generated.
   */
  occurrencesDueIn(
    range: CalendarDateRange,
    today: CalendarDate,
  ): PmOccurrence<E>[] {
    const to = this.lastDayIn(range.to);
    if (to.isBefore(range.from)) {
      return [];
    }
    // Judged against the schedule's next due date, gap or not: filtered
    // only once each has its next.
    const dueDates = this.schedule.dueDatesBetween(range.from, to);
    return dueDates.flatMap((dueDate, index) =>
      this.generatesOn(dueDate)
        ? [
            this.occurrence(
              dueDate,
              () =>
                dueDates[index + 1] ?? this.schedule.occurrenceAfter(dueDate),
              today,
            ),
          ]
        : [],
    );
  }

  /**
   * Every occurrence `missed` as of `today` whose due date is in `range` —
   * or in the whole history when `null` — oldest first: what the equipment
   * history lists beside the executions (issue #114). Only the due dates
   * from the first one to today are walked, `range` narrowing them, and each
   * is judged as `occurrencesDueIn` judges it — against the schedule's next
   * due date, even one beyond the range; none after the stop date, none in a
   * service gap.
   */
  occurrencesMissedIn(
    range: CalendarDateRange | null,
    today: CalendarDate,
  ): PmOccurrence<E>[] {
    const firstDueDate = this.schedule.firstDueDate();
    const from =
      range && range.from.isAfter(firstDueDate) ? range.from : firstDueDate;
    const to = range && range.to.isBefore(today) ? range.to : today;
    if (to.isBefore(from)) {
      return [];
    }
    return this.occurrencesDueIn(
      CalendarDateRange.between(from, to),
      today,
    ).filter((occurrence) => occurrence.status === PmOccurrenceStatus.Missed);
  }

  /**
   * Every occurrence whose `calendarDate` is in `range`, oldest due first —
   * the calendar's rows for this plan item. Two kinds: those due in the range
   * and not done late after it, and those done late inside it while due
   * before it. The second are found from the executions, not the schedule: a
   * later interval change can put any number of due dates between a due date
   * and the day it was done late.
   */
  occurrencesPlacedIn(
    range: CalendarDateRange,
    today: CalendarDate,
  ): PmOccurrence<E>[] {
    const doneLateInside = [...this.executionsByDueDate.values()]
      .filter(
        (execution) =>
          execution.dueDate().isBefore(range.from) &&
          this.generatesOn(execution.dueDate()) &&
          execution.status() === PmOccurrenceStatus.Late &&
          range.contains(execution.performedOn()),
      )
      .map((execution) => execution.dueDate())
      .toSorted((left, right) => right.daysUntil(left))
      .map((dueDate) => this.occurrenceOn(dueDate, today));
    const dueInside = this.occurrencesDueIn(range, today).filter(
      (occurrence) => !occurrence.calendarDate.isAfter(range.to),
    );
    return [...doneLateInside, ...dueInside];
  }

  /**
   * The occurrence an execution recorded `today` starts from: the latest due
   * date reached since service last resumed, or else the first one from then
   * on (the first due date, without a gap).
   */
  private currentDueDate(today: CalendarDate): CalendarDate {
    return (
      this.latestReachedSinceService(today) ??
      this.firstDueOnOrAfter(
        this.serviceResumedBy(today) ?? this.schedule.firstDueDate(),
      )
    );
  }

  /**
   * The latest due date generated on or before `day` — `null` before the
   * first one, or when a service gap ended between it and `day`.
   */
  private latestReachedSinceService(day: CalendarDate): CalendarDate | null {
    let latest = this.schedule.latestDueDateOnOrBefore(day);
    let gap =
      latest && this.isSkipped(latest) ? this.gapContaining(latest) : null;
    while (latest && gap) {
      // The latest work recorded inside the gap, else the last due date
      // before it — a jump, not a walk over every skipped due date.
      latest =
        this.latestDoneWithin(gap, latest) ??
        this.schedule.latestDueDateOnOrBefore(gap.from.plusDays(-1));
      gap =
        latest && this.isSkipped(latest) ? this.gapContaining(latest) : null;
    }
    const resumed = this.serviceResumedBy(day);
    if (latest && resumed && latest.isBefore(resumed)) {
      return null;
    }
    return latest;
  }

  /** The first due date generated on or after `day`, gaps skipped. */
  private firstDueOnOrAfter(day: CalendarDate): CalendarDate {
    let due = this.schedule.occurrenceAfter(day.plusDays(-1));
    let gap = this.gapContaining(due);
    while (gap) {
      if (gap.until === null) {
        // Unreachable: `assertInForce` refuses an item still out of service.
        throw new Error('A retired PM plan item has no next due date');
      }
      due = this.schedule.occurrenceAfter(gap.until.plusDays(-1));
      gap = this.gapContaining(due);
    }
    return due;
  }

  /** The day service last resumed on or before `day`, or `null`. */
  private serviceResumedBy(day: CalendarDate): CalendarDate | null {
    return (
      this.gaps.findLast((gap) => gap.until !== null && !gap.until.isAfter(day))
        ?.until ?? null
    );
  }

  /** The latest due date in `gap`, no later than `day`, that has an execution. */
  private latestDoneWithin(
    gap: ServiceGap,
    day: CalendarDate,
  ): CalendarDate | null {
    let latest: CalendarDate | null = null;
    for (const execution of this.executionsByDueDate.values()) {
      const dueDate = execution.dueDate();
      if (
        gap.contains(dueDate) &&
        !dueDate.isAfter(day) &&
        (!latest || dueDate.isAfter(latest))
      ) {
        latest = dueDate;
      }
    }
    return latest;
  }

  /** A due date out of service with no work recorded for it. */
  private isSkipped(day: CalendarDate): boolean {
    return (
      this.gapContaining(day) !== null &&
      !this.executionsByDueDate.has(day.asString())
    );
  }

  private isOutOfServiceNow(): boolean {
    return this.gaps.some((gap) => gap.isOpen());
  }

  private gapContaining(day: CalendarDate): ServiceGap | null {
    return this.gaps.find((gap) => gap.contains(day)) ?? null;
  }

  /** `day`, or the stop date when that comes first. */
  private lastDayIn(day: CalendarDate): CalendarDate {
    return this.stopDate && this.stopDate.isBefore(day) ? this.stopDate : day;
  }

  private isAfterStop(day: CalendarDate): boolean {
    return this.stopDate !== null && day.isAfter(this.stopDate);
  }

  private assertInForce(): void {
    if (this.stopDate) {
      throw new Error(
        `A PM plan item stopped on ${this.stopDate.asString()} takes no more work`,
      );
    }
    if (this.isOutOfServiceNow()) {
      throw new Error('A PM plan item of retired equipment takes no more work');
    }
  }

  /**
   * `nextDueDate` is asked for only when the occurrence is undone and today
   * is past it, so a read never computes a due date it does not need.
   */
  private occurrence(
    dueDate: CalendarDate,
    nextDueDate: () => CalendarDate,
    today: CalendarDate,
  ): PmOccurrence<E> {
    const execution = this.executionsByDueDate.get(dueDate.asString()) ?? null;
    if (execution) {
      const status = execution.status();
      return {
        dueDate,
        calendarDate:
          status === PmOccurrenceStatus.Late
            ? execution.performedOn()
            : dueDate,
        status,
        daysOverdue: 0,
        missedOn: null,
        execution,
      };
    }
    if (today.isBefore(dueDate)) {
      return unexecuted(dueDate, PmOccurrenceStatus.Upcoming);
    }
    if (today.equals(dueDate)) {
      return unexecuted(dueDate, PmOccurrenceStatus.Due);
    }
    const missedOn = nextDueDate();
    if (today.isBefore(missedOn)) {
      return {
        ...unexecuted(dueDate, PmOccurrenceStatus.Overdue),
        daysOverdue: dueDate.daysUntil(today),
      };
    }
    return { ...unexecuted(dueDate, PmOccurrenceStatus.Missed), missedOn };
  }
}

function unexecuted<E extends ExecutedOccurrence>(
  dueDate: CalendarDate,
  status: PmOccurrenceStatus,
): PmOccurrence<E> {
  return {
    dueDate,
    calendarDate: dueDate,
    status,
    daysOverdue: 0,
    missedOn: null,
    execution: null,
  };
}
