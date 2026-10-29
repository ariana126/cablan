import { TZDate } from '@date-fns/tz';
import { ValueObject } from '@framework/domain';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * The zone every maintenance date is read in: "today", and the day an
 * execution was performed on, are Tehran calendar dates whatever zone the
 * server runs in.
 */
export const MAINTENANCE_TIME_ZONE = 'Asia/Tehran';

/**
 * A Gregorian calendar date with no time of day — a due date, or the day
 * something was done on — carried as ISO `YYYY-MM-DD`. Day arithmetic counts
 * whole days, so it never meets a daylight-saving or zone offset.
 */
export class CalendarDate extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static fromString(value: string): CalendarDate {
    const match = ISO_DATE.exec(value);
    if (!match) {
      throw new Error(`Not an ISO calendar date: ${value}`);
    }
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Not an existing calendar date: ${value}`);
    }
    return new CalendarDate(value);
  }

  /** The calendar date `instant` falls on in Tehran — what "today" means here. */
  static inTehranOf(instant: Date): CalendarDate {
    const local = new TZDate(instant.getTime(), MAINTENANCE_TIME_ZONE);
    return CalendarDate.fromEpochDay(
      Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) /
        MS_PER_DAY,
    );
  }

  private static fromEpochDay(epochDay: number): CalendarDate {
    return new CalendarDate(
      new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10),
    );
  }

  private epochDay(): number {
    return Date.parse(`${this.value}T00:00:00.000Z`) / MS_PER_DAY;
  }

  plusDays(days: number): CalendarDate {
    return CalendarDate.fromEpochDay(this.epochDay() + days);
  }

  /** Whole days from this date to `other`; negative when `other` is earlier. */
  daysUntil(other: CalendarDate): number {
    return other.epochDay() - this.epochDay();
  }

  isBefore(other: CalendarDate): boolean {
    return this.value < other.value;
  }

  isAfter(other: CalendarDate): boolean {
    return this.value > other.value;
  }

  asString(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
