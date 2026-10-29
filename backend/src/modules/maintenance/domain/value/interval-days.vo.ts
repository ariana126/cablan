import { ValueObject } from '@framework/domain';

import { UsageBasedIntervalNotSupported } from '../exceptions/usage-based-interval-not-supported.exception';
import { IntervalUnit } from './interval-unit';

/** How many whole days apart a PM plan item falls due. */
export class IntervalDays extends ValueObject {
  private constructor(private readonly value: number) {
    super();
  }

  static of(days: number): IntervalDays {
    if (!Number.isInteger(days) || days < 1) {
      throw new Error(
        `A PM interval must be a positive whole number of days, got ${days}`,
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
