import { DomainException } from '@framework/domain';

// A date range asked to start after it ends. The PM schedule's reads turn
// it into `InvalidPmScheduleRange`, a 400 `invalid-pm-schedule-range`; from
// the equipment history's range it is a 400 `validation-error` on `from`
// (the module's exception mapper).
export class DateRangeStartsAfterEnd extends DomainException {
  private constructor(
    message: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(message);
  }

  public static between(from: string, to: string): DateRangeStartsAfterEnd {
    return new DateRangeStartsAfterEnd(
      `A date range cannot start after it ends: ${from} – ${to}`,
      from,
      to,
    );
  }
}
