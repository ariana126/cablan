import { ValueObject } from '@framework/domain';

import { CalendarDate } from './calendar-date.vo';
import { IntervalDays } from './interval-days.vo';

/**
 * One stretch of a schedule: due dates `startDueDate + k·intervalDays`, up to
 * (not including) the day the next segment takes over — its `startDueDate`,
 * or for a restart its `restartedOn`.
 *
 * A **restart** (issue #110) is the segment a reactivated equipment's item
 * gets when it is given a new first due date: `restartedOn` is the
 * reactivation day, on which the previous calendar stops, and its due dates
 * start at `startDueDate`, on or after that day — not necessarily on one of
 * the previous segment's due dates.
 */
export interface PmScheduleSegment {
  readonly startDueDate: CalendarDate;
  readonly intervalDays: IntervalDays;
  readonly restartedOn?: CalendarDate;
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
 * dates, strictly later than its start — except a restart, which takes over
 * on a reactivation day strictly after the previous segment took over (see
 * `restartedOn()`). See the designs,
 * docs/superpowers/specs/2026-10-29-maintenance-management-design.md and
 * docs/superpowers/specs/2026-11-04-system-admin-dependency-exceptions-design.md.
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
    if (segments[0].restartedOn) {
      throw new Error('A PM schedule does not begin with a restart');
    }
    for (let index = 1; index < segments.length; index++) {
      assertFollows(segments[index - 1], segments[index]);
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
    if (day.isBefore(segment.startDueDate)) {
      // A restart not yet due: the latest is the previous calendar's last.
      return this.latestDueDateOnOrBefore(takesOverOn(segment).plusDays(-1));
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
    if (dueDate.isBefore(startDueDate)) {
      // Between a restart's day and its first due date.
      return this.reachedFrom(index, startDueDate);
    }
    const interval = intervalDays.asNumber();
    const offset =
      (Math.floor(startDueDate.daysUntil(dueDate) / interval) + 1) * interval;
    // This segment's due dates stop on the day the next one takes over: its
    // first due date is the next one. Measured before the step is taken, so
    // the arithmetic never leaves the calendar's years.
    const next = this._segments[index + 1];
    if (next && startDueDate.daysUntil(takesOverOn(next)) <= offset) {
      return this.reachedFrom(index + 1, next.startDueDate);
    }
    return startDueDate.plusDays(offset);
  }

  /**
   * `dueDate`, segment `index`'s first, unless a later segment took over
   * before it was reached — a restart overtaken by another reactivation
   * before its first due date — and then the first due date of the first
   * segment that was reached.
   */
  private reachedFrom(index: number, dueDate: CalendarDate): CalendarDate {
    let current = index;
    let due = dueDate;
    let next = this._segments[current + 1];
    while (next && !due.isBefore(takesOverOn(next))) {
      current += 1;
      due = next.startDueDate;
      next = this._segments[current + 1];
    }
    return due;
  }

  /**
   * Every due date in `[from, to]`, both inclusive, oldest first — computed
   * per segment from the range's bounds, so a range months ahead or a long
   * history costs only the dates it holds.
   */
  dueDatesBetween(from: CalendarDate, to: CalendarDate): CalendarDate[] {
    const dueDates: CalendarDate[] = [];
    for (let index = 0; index < this._segments.length; index++) {
      const segment = this._segments[index];
      const { startDueDate, intervalDays } = segment;
      const nextStart = nextTakeOver(this._segments, index);
      // Segments are in take-over order; one taking over after the range
      // ends, and every later one, holds none of its due dates. (A restart's
      // first due date can lie past a later segment's take-over, so it is
      // not what to stop on.)
      if (takesOverOn(segment).isAfter(to)) {
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
      // A restart replaced from its own first due date stays a restart.
      return new PmSchedule([
        ...this._segments.slice(0, -1),
        { ...last, intervalDays },
      ]);
    }
    const segment = { startDueDate, intervalDays };
    assertStartsOnDueDateOf(last, segment);
    return new PmSchedule([...this._segments, segment]);
  }

  /**
   * The schedule restarted when its equipment is reactivated on `day`
   * (issue #110): the interval in force kept, its due dates from
   * `firstDueDate` — on or after `day` — and the previous calendar stopped
   * on `day`. A segment that had not taken over by `day` generated nothing,
   * so it gives way; when none had, the schedule simply starts on
   * `firstDueDate`. A restart that took over earlier stays even if its first
   * due date was never reached (its equipment retired again first): it is
   * what stopped the calendar before it.
   */
  restartedOn(day: CalendarDate, firstDueDate: CalendarDate): PmSchedule {
    if (firstDueDate.isBefore(day)) {
      throw new Error(
        `A restart on ${day.asString()} cannot first fall due before it, on ${firstDueDate.asString()}`,
      );
    }
    const intervalDays = this.intervalDays();
    const begun = this._segments.filter((segment) =>
      takesOverOn(segment).isBefore(day),
    );
    if (begun.length === 0) {
      return PmSchedule.startingOn(firstDueDate, intervalDays);
    }
    return new PmSchedule([
      ...begun,
      { startDueDate: firstDueDate, intervalDays, restartedOn: day },
    ]);
  }

  /**
   * The index of the segment `day` falls in — the last one that took over on
   * or before it — or `-1` before the first due date.
   */
  private segmentIndexAt(day: CalendarDate): number {
    return this._segments.findLastIndex(
      (segment) => !takesOverOn(segment).isAfter(day),
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
      const nextStart = nextTakeOver(this._segments, index);
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

/** The day a segment's calendar replaces the previous one's. */
function takesOverOn(segment: PmScheduleSegment): CalendarDate {
  return segment.restartedOn ?? segment.startDueDate;
}

function nextTakeOver(
  segments: readonly PmScheduleSegment[],
  index: number,
): CalendarDate | undefined {
  const next = segments[index + 1];
  return next ? takesOverOn(next) : undefined;
}

function assertFollows(
  previous: PmScheduleSegment,
  next: PmScheduleSegment,
): void {
  if (!next.restartedOn) {
    assertStartsOnDueDateOf(previous, next);
    return;
  }
  // After the previous segment took over — not necessarily after its first
  // due date: a restart can be overtaken before it was reached.
  if (
    !next.restartedOn.isAfter(takesOverOn(previous)) ||
    next.startDueDate.isBefore(next.restartedOn)
  ) {
    throw new Error(
      `A PM schedule restart must take over after the previous segment took over and first fall due on or after it, not on ${next.restartedOn.asString()} from ${next.startDueDate.asString()}`,
    );
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
