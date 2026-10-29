import { DomainException } from '@framework/domain';

// A PM plan item whose interval is counted in operating hours rather than
// days. The plan's structure names the unit, but usage-based planning is not
// offered yet. A 400 `usage-based-interval-not-supported`.
export class UsageBasedIntervalNotSupported extends DomainException {
  private constructor(
    message: string,
    public readonly intervalUnit: string,
  ) {
    super(message);
  }

  public static forUnit(intervalUnit: string): UsageBasedIntervalNotSupported {
    return new UsageBasedIntervalNotSupported(
      `A PM interval can only be planned in days, not in ${intervalUnit}`,
      intervalUnit,
    );
  }
}
