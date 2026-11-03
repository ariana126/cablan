import { ValueObject } from '@framework/domain';

/** The most operating hours an execution may report. */
export const MAX_OPERATING_HOURS = 1_000_000;

/**
 * How many hours the equipment has run since the activity was last done on
 * it, as the performer reads it when recording a job: 0 to
 * `MAX_OPERATING_HOURS`, at most two decimals. Recorded as told — never
 * compared with an earlier execution's hours, which may well be higher.
 */
export class OperatingHours extends ValueObject {
  private constructor(private readonly value: number) {
    super();
  }

  static of(hours: number): OperatingHours {
    if (
      !Number.isFinite(hours) ||
      hours < 0 ||
      hours > MAX_OPERATING_HOURS ||
      !hasAtMostTwoDecimals(hours)
    ) {
      throw new Error(
        `Operating hours must be from 0 to ${MAX_OPERATING_HOURS} with at most two decimals, got ${hours}`,
      );
    }
    return new OperatingHours(hours);
  }

  asNumber(): number {
    return this.value;
  }
}

function hasAtMostTwoDecimals(hours: number): boolean {
  return Math.round(hours * 100) / 100 === hours;
}
