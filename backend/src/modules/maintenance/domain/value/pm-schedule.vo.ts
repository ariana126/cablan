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
    return this.latestDueDateOnOrBefore(today) ?? this.firstDueDate();
  }

  /**
   * The latest due date on or before `day`, or `null` before the first due
   * date. Arithmetic on the segment `day` falls in, not a walk.
   */
  latestDueDateOnOrBefore(day: CalendarDate): CalendarDate | null {
    const segment = this._segments[this.segmentIndexAt(day)];
    if (!segment) {
      return null;
    }
    const interval = segment.intervalDays.asNumber();
    const steps = Math.floor(segment.startDueDate.daysUntil(day) / interval);
    return segment.startDueDate.plusDays(steps * interval);
  }

  /** The due date that follows `dueDate` (or any other day). */
  occurrenceAfter(dueDate: CalendarDate): CalendarDate {
    const index = this.segmentIndexAt(dueDate);
    if (index < 0) {
      return this.firstDueDate();
    }
    const { startDueDate, intervalDays } = this._segments[index];
    const interval = intervalDays.asNumber();
    const offset =
      (Math.floor(startDueDate.daysUntil(dueDate) / interval) + 1) * interval;
    // A later segment starts on one of this one's due dates, so the next due
    // date is never past that start.
    const nextStart = this._segments[index + 1]?.startDueDate;
    if (nextStart && startDueDate.daysUntil(nextStart) <= offset) {
      return nextStart;
    }
    return startDueDate.plusDays(offset);
  }

  /**
   * Every due date in `[from, to]`, both inclusive, oldest first — computed
   * per segment from the range's bounds, so a range months ahead or a long
   * history costs only the dates it holds.
   */
  dueDatesBetween(from: CalendarDate, to: CalendarDate): CalendarDate[] {
    const dueDates: CalendarDate[] = [];
    for (let index = 0; index < this._segments.length; index++) {
      const { startDueDate, intervalDays } = this._segments[index];
      const nextStart = this._segments[index + 1]?.startDueDate;
      if (startDueDate.isAfter(to)) {
        break;
      }
      if (nextStart && !nextStart.isAfter(from)) {
        continue;
      }
      const interval = intervalDays.asNumber();
      const offset =
        Math.max(0, Math.ceil(startDueDate.daysUntil(from) / interval)) *
        interval;
      // Each step is measured against `to` before it is taken, so the
      // arithmetic never leaves the calendar's years.
      if (startDueDate.daysUntil(to) < offset) {
        continue;
      }
      let due = startDueDate.plusDays(offset);
      while (!nextStart || due.isBefore(nextStart)) {
        dueDates.push(due);
        if (due.daysUntil(to) < interval) {
          break;
        }
        due = due.plusDays(interval);
      }
    }
    return dueDates;
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

  /**
   * The index of the segment `day` falls in — the last one starting on or
   * before it — or `-1` before the first due date.
   */
  private segmentIndexAt(day: CalendarDate): number {
    return this._segments.findLastIndex(
      (segment) => !segment.startDueDate.isAfter(day),
    );
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
