import { ValueObject } from '@framework/domain';

import { CalendarDate } from './calendar-date.vo';
import { ServiceGap } from './service-gap.vo';

/**
 * One retirement of a piece of equipment and the reactivation that ended
 * it, if any (issue #110). The equipment is retired exactly while its last
 * break is still open.
 */
export class ServiceBreak extends ValueObject {
  private constructor(
    private readonly _retiredAt: Date,
    private readonly _reactivatedAt: Date | null,
  ) {
    super();
  }

  /** The equipment retired at `retiredAt`, not yet back in service. */
  static startingAt(retiredAt: Date): ServiceBreak {
    return new ServiceBreak(retiredAt, null);
  }

  /** Rebuilds a stored break. */
  static restore(retiredAt: Date, reactivatedAt: Date | null): ServiceBreak {
    if (reactivatedAt && reactivatedAt < retiredAt) {
      throw new Error(
        `Equipment cannot be reactivated (${reactivatedAt.toISOString()}) before it was retired (${retiredAt.toISOString()})`,
      );
    }
    return new ServiceBreak(retiredAt, reactivatedAt);
  }

  /** This break, ended by a reactivation at `reactivatedAt`. */
  endingAt(reactivatedAt: Date): ServiceBreak {
    if (!this.isOpen()) {
      throw new Error('A service break ends once');
    }
    return ServiceBreak.restore(this._retiredAt, reactivatedAt);
  }

  retiredAt(): Date {
    return this._retiredAt;
  }

  reactivatedAt(): Date | null {
    return this._reactivatedAt;
  }

  /**
   * The Tehran date it was retired on — still in service, as before issue
   * #110: retiring is like deactivating every row that day.
   */
  retiredOn(): CalendarDate {
    return CalendarDate.inTehranOf(this._retiredAt);
  }

  isOpen(): boolean {
    return this._reactivatedAt === null;
  }

  /**
   * The days it keeps the equipment out of service: from the day after its
   * retirement day — that day itself stays in service — on while open, up
   * to its reactivation day once ended; `null` when reactivated on the
   * retirement day or the day after.
   */
  gap(): ServiceGap | null {
    const from = this.retiredOn().plusDays(1);
    if (this._reactivatedAt === null) {
      return ServiceGap.from(from);
    }
    const until = CalendarDate.inTehranOf(this._reactivatedAt);
    return until.isAfter(from) ? ServiceGap.between(from, until) : null;
  }
}
