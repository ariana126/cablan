import { addDays, format, getDaysInMonth, getMonth, getYear, newDate } from 'date-fns-jalali';

import { toPersianDigits } from '../i18n/persian-numerals';

/** JavaScript's `getDay()` for Saturday, the first day of the Persian week. */
const SATURDAY = 6;
const DAYS_IN_WEEK = 7;

/** One cell of a month's grid: a day, and whether it belongs to the month or only pads a week. */
export interface JalaliMonthDay {
  /** Local midnight of the day. */
  readonly date: Date;
  readonly inMonth: boolean;
}

/**
 * A month of the Jalali calendar — what the PM schedule's calendar shows, and what its table's range
 * defaults to. A value: immutable, compared with `equals`, stepped with `plus`.
 *
 * Every `Date` it hands out is a **local midnight**, the way the app's datepickers write a picked
 * day, so `toIsoCalendarDate` turns one into the ISO date the API takes without going through UTC.
 * The calendar arithmetic is `date-fns-jalali`'s, the same library the datepicker adapter uses —
 * there is one Jalali calendar in the app, not two.
 */
export class JalaliMonth {
  private constructor(
    /** The Jalali year, e.g. `1405`. */
    readonly year: number,
    /** The Jalali month, `1` (فروردین) to `12` (اسفند). */
    readonly month: number,
  ) {}

  static of(year: number, month: number): JalaliMonth {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new RangeError(`Not a Jalali month: ${year}/${month}`);
    }
    return new JalaliMonth(year, month);
  }

  /** The month the given day falls in, read from its local calendar fields. */
  static containing(date: Date): JalaliMonth {
    return new JalaliMonth(getYear(date), getMonth(date) + 1);
  }

  get firstDay(): Date {
    return newDate(this.year, this.month - 1, 1);
  }

  get lastDay(): Date {
    return newDate(this.year, this.month - 1, getDaysInMonth(this.firstDay));
  }

  /** «دی ۱۴۰۵». */
  get title(): string {
    return toPersianDigits(format(this.firstDay, 'LLLL yyyy'));
  }

  /** The month `count` months later (earlier, when negative). */
  plus(count: number): JalaliMonth {
    const index = this.year * 12 + (this.month - 1) + count;
    return new JalaliMonth(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
  }

  equals(other: JalaliMonth): boolean {
    return this.year === other.year && this.month === other.month;
  }

  /**
   * The month as whole weeks, Saturday first: the days before its first and after its last that
   * complete a week belong to the neighbouring months and are marked `inMonth: false`.
   */
  weeks(): JalaliMonthDay[][] {
    const first = this.firstDay;
    const leading = (first.getDay() - SATURDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK;
    const length = getDaysInMonth(first);
    const cellCount = Math.ceil((leading + length) / DAYS_IN_WEEK) * DAYS_IN_WEEK;

    const weeks: JalaliMonthDay[][] = [];
    for (let cell = 0; cell < cellCount; cell++) {
      const offset = cell - leading;
      if (cell % DAYS_IN_WEEK === 0) {
        weeks.push([]);
      }
      weeks[weeks.length - 1].push({
        date: addDays(first, offset),
        inMonth: offset >= 0 && offset < length,
      });
    }
    return weeks;
  }
}
