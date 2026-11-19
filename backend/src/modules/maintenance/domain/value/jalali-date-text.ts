import { jalaliDateAndTime, toAsciiDigits } from '@framework/domain';
import {
  getDate as getJalaliDay,
  getMonth as getJalaliMonth,
  getYear as getJalaliYear,
  newDate as newJalaliDate,
} from 'date-fns-jalali';

import { CalendarDate } from './calendar-date.vo';

const JALALI_DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

/**
 * The Gregorian years a first due date may fall in — the same window the
 * plan form's `firstDueDate` is held to — so no schedule walks off the
 * calendar a read can name.
 */
const FIRST_YEAR = 2000;
const LAST_YEAR = 2100;

/**
 * The calendar date a Jalali date written as text names — `1405/08/30`, or
 * `1405/10/1` with a one-digit month or day, Persian digits allowed — or
 * `null` when the text is not an existing Jalali date in years 2000–2100
 * (Gregorian).
 */
export function calendarDateFromJalaliText(text: string): CalendarDate | null {
  const match = JALALI_DATE.exec(toAsciiDigits(text.trim()));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);

  // `newJalaliDate` rolls an impossible day or month over into the next one,
  // so the date it built must read back as the one written.
  const date = newJalaliDate(year, month - 1, day);
  if (
    getJalaliYear(date) !== year ||
    getJalaliMonth(date) !== month - 1 ||
    getJalaliDay(date) !== day
  ) {
    return null;
  }
  const gregorianYear = date.getFullYear();
  if (gregorianYear < FIRST_YEAR || gregorianYear > LAST_YEAR) return null;
  return CalendarDate.fromString(
    `${gregorianYear}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  );
}

/**
 * A spreadsheet date cell as the Jalali text `yyyy/MM/dd`. A spreadsheet
 * stores a date with no zone, which the reader hands over as that day's UTC
 * midnight, so it is read in UTC.
 */
export function jalaliTextOf(spreadsheetDate: Date): string {
  return jalaliDateAndTime(spreadsheetDate, 'UTC').date;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
