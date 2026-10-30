import { ValueObject } from '@framework/domain';

import { UsageBasedIntervalNotSupported } from '../exceptions/usage-based-interval-not-supported.exception';
import { IntervalUnit } from './interval-unit';

/**
 * The longest interval a plan may hold: a hundred years of days. Beyond it a
 * schedule's due dates soon leave the calendar `CalendarDate` can name, and
 * every read that walks them would fail.
 */
export const MAX_INTERVAL_DAYS = 36_500;

/** How many whole days apart a PM plan item falls due, at most `MAX_INTERVAL_DAYS`. */
export class IntervalDays extends ValueObject {
  private constructor(private readonly value: number) {
    super();
  }

  static of(days: number): IntervalDays {
    if (!Number.isInteger(days) || days < 1 || days > MAX_INTERVAL_DAYS) {
      throw new Error(
        `A PM interval must be a whole number of days from 1 to ${MAX_INTERVAL_DAYS}, got ${days}`,
      );
    }
    return new IntervalDays(days);
  }

  /**
   * An interval as the plan form states it — a value and its unit. Only days
   * can be planned yet; operating hours are refused here, in the domain.
   */
  static fromInterval(value: number, unit: IntervalUnit): IntervalDays {
    if (unit !== IntervalUnit.Days) {
      throw UsageBasedIntervalNotSupported.forUnit(unit);
    }
    return IntervalDays.of(value);
  }

  asNumber(): number {
    return this.value;
  }
}
