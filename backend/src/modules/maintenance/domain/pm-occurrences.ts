import { CalendarDate } from './value/calendar-date.vo';
import { CalendarDateRange } from './value/calendar-date-range.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { PmSchedule } from './value/pm-schedule.vo';

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
  readonly execution: E | null;
}

/**
 * One PM plan item's occurrences against its executions — the pure
 * calculator behind the daily list, the overview, the next due date (which is
 * also the occurrence an execution is recorded for) and where an interval
 * change takes effect. Nothing missed is ever stored: every status is
 * computed here, from the schedule, the executions and today. The rules are
 * the design's (docs/superpowers/specs/2026-10-29-maintenance-management-design.md).
 */
export class PmOccurrences<E extends ExecutedOccurrence> {
  private readonly executionsByDueDate: ReadonlyMap<string, E>;

  /**
   * `stopDate` is the last day the item was in force — deactivated, or its
   * equipment retired (`Equipment.stopDateOf`) — or `null` while it still
   * is. No occurrence exists after it, whatever the method asked.
   */
  constructor(
    private readonly schedule: PmSchedule,
    executions: readonly E[],
    private readonly stopDate: CalendarDate | null = null,
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
    if (this.isAfterStop(dueDate)) {
      throw new Error(
        `No occurrence due ${dueDate.asString()}: the item stopped on ${this.stopDate?.asString()}`,
      );
    }
    return this.occurrence(
      dueDate,
      () => this.schedule.occurrenceAfter(dueDate),
      today,
    );
  }

  /**
   * The occurrence `today` falls in — the latest due date reached — or
   * `null` before the first due date; for a stopped item, the last one
   * reached by the stop date. The daily list shows it while it is `due` or
   * `overdue`.
   */
  currentOccurrence(today: CalendarDate): PmOccurrence<E> | null {
    const current = this.schedule.latestDueDateOnOrBefore(
      this.lastDayIn(today),
    );
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
    let target = this.schedule.currentOccurrence(today);
    while (this.executionsByDueDate.has(target.asString())) {
      target = this.schedule.occurrenceAfter(target);
    }
    return target;
  }

  /**
   * Where an interval changed on `today` takes effect: the current
   * occurrence — or, when an occurrence ahead of it is already done, the
   * latest one done, so no execution is left on a due date the new interval
   * no longer generates. A stopped item takes no change.
   */
  intervalChangeStart(today: CalendarDate): CalendarDate {
    this.assertInForce();
    let start = this.schedule.currentOccurrence(today);
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
    const dueDates = this.schedule.dueDatesBetween(range.from, to);
    return dueDates.map((dueDate, index) =>
      this.occurrence(
        dueDate,
        () => dueDates[index + 1] ?? this.schedule.occurrenceAfter(dueDate),
        today,
      ),
    );
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
          !this.isAfterStop(execution.dueDate()) &&
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
        execution,
      };
    }
    if (today.isBefore(dueDate)) {
      return unexecuted(dueDate, PmOccurrenceStatus.Upcoming);
    }
    if (today.equals(dueDate)) {
      return unexecuted(dueDate, PmOccurrenceStatus.Due);
    }
    if (today.isBefore(nextDueDate())) {
      return {
        ...unexecuted(dueDate, PmOccurrenceStatus.Overdue),
        daysOverdue: dueDate.daysUntil(today),
      };
    }
    return unexecuted(dueDate, PmOccurrenceStatus.Missed);
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
    execution: null,
  };
}
