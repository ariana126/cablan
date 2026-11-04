import { ValueObject } from '@framework/domain';

import { CalendarDate } from './calendar-date.vo';

/**
 * The days a piece of equipment was out of service (issue #110): from the
 * day after the Tehran date it was retired — the retirement day itself stays
 * in service — up to, but not including, the Tehran date it was reactivated,
 * or without end while it is still retired. No due date in
 * it is generated unless work was recorded for it anyway (done before the
 * retirement). A closed gap is never empty.
 */
export class ServiceGap extends ValueObject {
  private constructor(
    /** Its first day. */
    readonly from: CalendarDate,
    /** The day service resumed — the first day after it — or `null` while retired. */
    readonly until: CalendarDate | null,
  ) {
    super();
  }

  static between(from: CalendarDate, until: CalendarDate): ServiceGap {
    if (!until.isAfter(from)) {
      throw new Error(
        `A service gap ends after it starts, not ${from.asString()} – ${until.asString()}`,
      );
    }
    return new ServiceGap(from, until);
  }

  /** Out of service from `from` on, not (yet) back. */
  static from(from: CalendarDate): ServiceGap {
    return new ServiceGap(from, null);
  }

  isOpen(): boolean {
    return this.until === null;
  }

  contains(day: CalendarDate): boolean {
    return (
      !day.isBefore(this.from) &&
      (this.until === null || day.isBefore(this.until))
    );
  }
}
