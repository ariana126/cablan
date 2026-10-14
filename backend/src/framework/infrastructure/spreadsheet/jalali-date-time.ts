import { tz } from '@date-fns/tz';
import { format } from 'date-fns-jalali';

/**
 * Renders an instant as the Jalali (Persian/Shamsi) date and time an operator reads —
 * `1403/04/01 08:30` — in **Latin digits**, because a spreadsheet cell reading `۱۴۰۳` is text
 * rather than a date to anything that opens the file.
 *
 * The time of day is read in `timeZone` (an IANA name). An export is a document someone reads
 * where they stand, so the caller passes the reader's own zone rather than the server's.
 */
export function formatJalaliDateTime(instant: Date, timeZone: string): string {
  return format(instant, 'yyyy/MM/dd HH:mm', { in: tz(timeZone) });
}
