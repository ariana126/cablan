import { ApplicationException } from '@framework/application';

/** Why a range was refused: one problem type, a detail per reason. */
export type InvalidPmScheduleRangeReason =
  | 'incomplete-or-reversed'
  | 'too-long';

// A PM schedule read asked for without a start or an end date, with the
// start after the end, or spanning more than `MAX_PM_SCHEDULE_RANGE_DAYS`.
// A 400 `invalid-pm-schedule-range`; a malformed date, or one outside years
// 2000–2100, is the ordinary validation 400 before this is reached.
export class InvalidPmScheduleRange extends ApplicationException {
  private constructor(
    message: string,
    public readonly reason: InvalidPmScheduleRangeReason,
    public readonly from: string | null,
    public readonly to: string | null,
  ) {
    super(message);
  }

  /** No start, no end, or the start after the end. */
  public static of(
    from: string | undefined,
    to: string | undefined,
  ): InvalidPmScheduleRange {
    return new InvalidPmScheduleRange(
      `Not a PM schedule range: from ${from ?? '(none)'} to ${to ?? '(none)'}`,
      'incomplete-or-reversed',
      from ?? null,
      to ?? null,
    );
  }

  public static tooLong(
    from: string,
    to: string,
    maxDays: number,
  ): InvalidPmScheduleRange {
    return new InvalidPmScheduleRange(
      `A PM schedule range spans at most ${maxDays} days, not ${from} to ${to}`,
      'too-long',
      from,
      to,
    );
  }
}
