import { tz } from '@date-fns/tz';
import { format } from 'date-fns-jalali';

/**
 * An instant as the Jalali (Persian/Shamsi) date and the 24-hour, zero-padded
 * time of day an operator reads — `{ date: '1403/04/01', time: '08:30' }` — in
 * **Latin digits**, read in `timeZone` (an IANA name).
 *
 * A pure calendar conversion with no I/O, so it lives in the domain: a
 * module's domain may render a stored text with it (`boms`' edit heading, in
 * Asia/Tehran), and infrastructure may render a spreadsheet cell with it (in
 * the reader's own zone).
 */
export function jalaliDateAndTime(
  instant: Date,
  timeZone: string,
): { date: string; time: string } {
  const zone = { in: tz(timeZone) };
  return {
    date: format(instant, 'yyyy/MM/dd', zone),
    time: format(instant, 'HH:mm', zone),
  };
}

/**
 * `jalaliDateAndTime` as one string — `1403/04/01 08:30` — the form a
 * spreadsheet cell carries. Latin digits, because a cell reading `۱۴۰۳` is
 * text rather than a date to anything that opens the file. An export is a
 * document someone reads where they stand, so the caller passes the reader's
 * own zone rather than the server's.
 */
export function formatJalaliDateTime(instant: Date, timeZone: string): string {
  const { date, time } = jalaliDateAndTime(instant, timeZone);
  return `${date} ${time}`;
}
