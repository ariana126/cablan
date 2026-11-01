import { ValueObject } from '@framework/domain';

import { DateRangeStartsAfterEnd } from '../exceptions/date-range-starts-after-end.exception';
import { CalendarDate } from './calendar-date.vo';

/**
 * The days from `from` through `to`, both inclusive — a range a PM read is
 * asked for. It never starts after it ends (`DateRangeStartsAfterEnd`).
 */
export class CalendarDateRange extends ValueObject {
  private constructor(
    readonly from: CalendarDate,
    readonly to: CalendarDate,
  ) {
    super();
  }

  static between(from: CalendarDate, to: CalendarDate): CalendarDateRange {
    if (from.isAfter(to)) {
      throw DateRangeStartsAfterEnd.between(from.asString(), to.asString());
    }
    return new CalendarDateRange(from, to);
  }

  contains(day: CalendarDate): boolean {
    return !day.isBefore(this.from) && !day.isAfter(this.to);
  }
}
