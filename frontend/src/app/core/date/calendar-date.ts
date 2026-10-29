import { format } from 'date-fns-jalali';

import { toPersianDigits } from '../i18n/persian-numerals';

const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar dates — a PM plan's due dates — as opposed to the instants `jalali-datetime.ts` formats.
 * The API sends and takes them as ISO `YYYY-MM-DD` (Gregorian, the Tehran calendar day): a day, not
 * a moment, so nothing here ever goes through UTC. `new Date('2026-09-23')` would be UTC midnight,
 * which west of Greenwich is the day before; both directions use the date's *local* fields instead.
 */

/** The day a datepicker picked (local midnight), as the API takes a date. */
export const toIsoCalendarDate = (date: Date): string =>
  [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

/** An ISO date as a visitor reads it: zero-padded Jalali `۱۴۰۵/۰۷/۰۱`, or `—` when unreadable. */
export const formatJalaliCalendarDate = (isoDate: string): string => {
  const match = ISO_CALENDAR_DATE.exec(isoDate);
  if (match === null) {
    return '—';
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? '—' : toPersianDigits(format(date, 'yyyy/MM/dd'));
};
