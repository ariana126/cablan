import { CalendarDate } from './value/calendar-date.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { PmSchedule } from './value/pm-schedule.vo';

/**
 * What the calculator needs of an execution: which occurrence it covers, and
 * whether it was on time — a judgement the execution makes itself, so there
 * is one on-time rule (`MaintenanceExecution.status()`).
 */
export interface ExecutedOccurrence {
  dueDate(): CalendarDate;
  status(): PmOccurrenceStatus.OnTime | PmOccurrenceStatus.Late;
}

export interface PmOccurrence<E extends ExecutedOccurrence> {
  readonly dueDate: CalendarDate;
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

  constructor(
    private readonly schedule: PmSchedule,
    executions: readonly E[],
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

  /** The occurrence falling due on `dueDate`, as it stands on `today`. */
  occurrenceOn(dueDate: CalendarDate, today: CalendarDate): PmOccurrence<E> {
    return this.occurrence(
      dueDate,
      this.schedule.occurrenceAfter(dueDate),
      today,
    );
  }

  /**
   * The occurrence `today` falls in — the latest due date reached — or
   * `null` before the first due date. The daily list shows it while it is
   * `due` or `overdue`.
   */
  currentOccurrence(today: CalendarDate): PmOccurrence<E> | null {
    const { reached, next } = this.schedule.occurrenceWindow(today);
    const current = reached.at(-1);
    return current ? this.occurrence(current, next, today) : null;
  }

  /**
   * The due date the plan shows as next, and the occurrence an execution
   * recorded today is for: the earliest one from the current occurrence on
   * that has no execution yet. So an occurrence already missed can never be
   * recorded, and one done early moves the work on to the next.
   */
  nextDueDate(today: CalendarDate): CalendarDate {
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
   * no longer generates.
   */
  intervalChangeStart(today: CalendarDate): CalendarDate {
    let start = this.schedule.currentOccurrence(today);
    for (const execution of this.executionsByDueDate.values()) {
      if (execution.dueDate().isAfter(start)) {
        start = execution.dueDate();
      }
    }
    return start;
  }

  /**
   * Every occurrence from the first due date through the next one not yet
   * reached, oldest first — the overview's rows for this plan item. One pass
   * over the schedule.
   */
  occurrencesThrough(today: CalendarDate): PmOccurrence<E>[] {
    const { reached, next } = this.schedule.occurrenceWindow(today);
    const dueDates = [...reached, next];
    return dueDates.map((dueDate, index) =>
      this.occurrence(
        dueDate,
        dueDates[index + 1] ?? this.schedule.occurrenceAfter(dueDate),
        today,
      ),
    );
  }

  private occurrence(
    dueDate: CalendarDate,
    nextDueDate: CalendarDate,
    today: CalendarDate,
  ): PmOccurrence<E> {
    const execution = this.executionsByDueDate.get(dueDate.asString()) ?? null;
    if (execution) {
      return { dueDate, status: execution.status(), daysOverdue: 0, execution };
    }
    if (today.isBefore(dueDate)) {
      return unexecuted(dueDate, PmOccurrenceStatus.Upcoming);
    }
    if (today.equals(dueDate)) {
      return unexecuted(dueDate, PmOccurrenceStatus.Due);
    }
    if (today.isBefore(nextDueDate)) {
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
  return { dueDate, status, daysOverdue: 0, execution: null };
}
