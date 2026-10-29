import { ValueObject } from '@framework/domain';

import { CalendarDate } from './calendar-date.vo';
import { IntervalDays } from './interval-days.vo';

/**
 * One stretch of a schedule: due dates `startDueDate + k·intervalDays`, up to
 * (not including) the next segment's `startDueDate`.
 */
export interface PmScheduleSegment {
  readonly startDueDate: CalendarDate;
  readonly intervalDays: IntervalDays;
}

/** The due dates on or before a day, and the first one after it. */
export interface PmOccurrenceWindow {
  readonly reached: readonly CalendarDate[];
  readonly next: CalendarDate;
}

/**
 * When a PM plan item falls due — a pure calculation, no I/O.
 *
 * A schedule is an ordered list of segments. Adding an item gives it one;
 * changing its interval appends one starting at a due date the schedule
 * already has, so the due dates before it are still generated from the
 * interval they fell under and their statuses never move. Which due date a
 * change starts from is the caller's rule (`PmOccurrences.intervalChangeStart`).
 * Every segment after the first starts on one of the previous segment's due
 * dates, strictly later than its start. See the design,
 * docs/superpowers/specs/2026-10-29-maintenance-management-design.md.
 */
export class PmSchedule extends ValueObject {
  private constructor(
    private readonly _segments: readonly PmScheduleSegment[],
  ) {
    super();
  }

  static startingOn(
    firstDueDate: CalendarDate,
    intervalDays: IntervalDays,
  ): PmSchedule {
    return new PmSchedule([{ startDueDate: firstDueDate, intervalDays }]);
  }

  /** Rebuilds a stored schedule, its segments oldest first. */
  static fromSegments(segments: readonly PmScheduleSegment[]): PmSchedule {
    if (segments.length === 0) {
      throw new Error('A PM schedule has at least one segment');
    }
    for (let index = 1; index < segments.length; index++) {
      assertStartsOnDueDateOf(segments[index - 1], segments[index]);
    }
    return new PmSchedule([...segments]);
  }

  segments(): readonly PmScheduleSegment[] {
    return this._segments;
  }

  firstDueDate(): CalendarDate {
    return this._segments[0].startDueDate;
  }

  /** The interval now in force — the last segment's. */
  intervalDays(): IntervalDays {
    return this.lastSegment().intervalDays;
  }

  /**
   * The latest due date on or before `today`, or the first due date while
   * that is still ahead.
   */
  currentOccurrence(today: CalendarDate): CalendarDate {
    return this.occurrenceWindow(today).reached.at(-1) ?? this.firstDueDate();
  }

  /** The due date that follows `dueDate`. */
  occurrenceAfter(dueDate: CalendarDate): CalendarDate {
    return this.occurrenceWindow(dueDate).next;
  }

  /** Every due date from the first through `limit`, inclusive. */
  dueDatesThrough(limit: CalendarDate): CalendarDate[] {
    return [...this.occurrenceWindow(limit).reached];
  }

  /**
   * The due dates on or before `today` and the first one after it, in one
   * pass over the schedule.
   */
  occurrenceWindow(today: CalendarDate): PmOccurrenceWindow {
    const reached: CalendarDate[] = [];
    for (const due of this.dueDates()) {
      if (due.isAfter(today)) {
        return { reached, next: due };
      }
      reached.push(due);
    }
    // Unreachable: the last segment never ends.
    throw new Error('A PM schedule never runs out of due dates');
  }

  /**
   * The schedule with `intervalDays` in force from `startDueDate` — one of
   * its own due dates, no earlier than its last segment's start. A change
   * from that same start replaces the last segment: the earlier one would
   * cover no due date.
   */
  withIntervalChangedFrom(
    startDueDate: CalendarDate,
    intervalDays: IntervalDays,
  ): PmSchedule {
    const last = this.lastSegment();
    if (last.startDueDate.equals(startDueDate)) {
      return new PmSchedule([
        ...this._segments.slice(0, -1),
        { startDueDate, intervalDays },
      ]);
    }
    const segment = { startDueDate, intervalDays };
    assertStartsOnDueDateOf(last, segment);
    return new PmSchedule([...this._segments, segment]);
  }

  private lastSegment(): PmScheduleSegment {
    const last = this._segments.at(-1);
    if (!last) {
      // Unreachable: both factories refuse an empty schedule.
      throw new Error('A PM schedule has at least one segment');
    }
    return last;
  }

  /** Every due date in order — endless, since the last segment never ends. */
  private *dueDates(): Generator<CalendarDate> {
    for (let index = 0; index < this._segments.length; index++) {
      const { startDueDate, intervalDays } = this._segments[index];
      const nextStart = this._segments[index + 1]?.startDueDate;
      for (
        let due = startDueDate;
        !nextStart || due.isBefore(nextStart);
        due = due.plusDays(intervalDays.asNumber())
      ) {
        yield due;
      }
    }
  }
}

function assertStartsOnDueDateOf(
  previous: PmScheduleSegment,
  next: PmScheduleSegment,
): void {
  const offset = previous.startDueDate.daysUntil(next.startDueDate);
  if (offset <= 0 || offset % previous.intervalDays.asNumber() !== 0) {
    throw new Error(
      `A PM schedule segment must start on a later due date of the previous one, not ${next.startDueDate.asString()}`,
    );
  }
}
