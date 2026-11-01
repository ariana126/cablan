import { ApplicationException } from '@framework/application';

// A PM schedule read asked for without a start or an end date, or with the
// start after the end. A 400 `invalid-pm-schedule-range`; a malformed date
// is the ordinary validation 400 before this is reached.
export class InvalidPmScheduleRange extends ApplicationException {
  private constructor(
    message: string,
    public readonly from: string | null,
    public readonly to: string | null,
  ) {
    super(message);
  }

  public static of(
    from: string | undefined,
    to: string | undefined,
  ): InvalidPmScheduleRange {
    return new InvalidPmScheduleRange(
      `Not a PM schedule range: from ${from ?? '(none)'} to ${to ?? '(none)'}`,
      from ?? null,
      to ?? null,
    );
  }
}
