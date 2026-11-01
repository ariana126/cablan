import { ExecutedOccurrence, PmOccurrence } from './pm-occurrences';
import { CalendarDateRange } from './value/calendar-date-range.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';
import { wholePercent } from './value/whole-percent';

/**
 * How well PM work was kept up over a range of days: of the occurrences due
 * in it, how many were done on time, done late, or not done (overdue or
 * missed). Adherence is the share done on time, completion the share done at
 * all; neither exists without an occurrence to judge («داده کافی وجود
 * ندارد»). The range is the caller's — the dashboard never includes today,
 * whose work is still open.
 */
export class PmPerformance {
  private constructor(
    private readonly _onTime: number,
    private readonly _daysLate: readonly number[],
    private readonly _notDone: number,
  ) {}

  /** The occurrences among `occurrences` due in `range`, judged. */
  static of(
    occurrences: readonly PmOccurrence<ExecutedOccurrence>[],
    range: CalendarDateRange,
  ): PmPerformance {
    let onTime = 0;
    let notDone = 0;
    const daysLate: number[] = [];
    for (const occurrence of occurrences) {
      if (!range.contains(occurrence.dueDate)) {
        continue;
      }
      switch (occurrence.status) {
        case PmOccurrenceStatus.OnTime: {
          onTime++;
          break;
        }
        case PmOccurrenceStatus.Late: {
          // A late occurrence always carries the execution that judged it.
          daysLate.push(occurrence.execution?.daysLate() ?? 0);
          break;
        }
        case PmOccurrenceStatus.Overdue:
        case PmOccurrenceStatus.Missed: {
          notDone++;
          break;
        }
        default: {
          // `due` and `upcoming` are never in a past range.
          break;
        }
      }
    }
    return new PmPerformance(onTime, daysLate, notDone);
  }

  considered(): number {
    return this._onTime + this._daysLate.length + this._notDone;
  }

  onTime(): number {
    return this._onTime;
  }

  late(): number {
    return this._daysLate.length;
  }

  notDone(): number {
    return this._notDone;
  }

  /** Done on time, as a whole percentage of those considered; `null` with none. */
  adherencePercent(): number | null {
    return this.percentOf(this._onTime);
  }

  /** Done at all, as a whole percentage of those considered; `null` with none. */
  completionPercent(): number | null {
    return this.percentOf(this._onTime + this.late());
  }

  /** The mean days late of those done late, to one decimal; `null` with none. */
  averageDaysLate(): number | null {
    if (this._daysLate.length === 0) {
      return null;
    }
    const total = this._daysLate.reduce((sum, days) => sum + days, 0);
    return Math.round((total / this._daysLate.length) * 10) / 10;
  }

  private percentOf(count: number): number | null {
    return wholePercent(count, this.considered());
  }
}
