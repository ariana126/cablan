import { format } from 'date-fns-jalali';

import { toPersianDigits } from '../i18n/persian-numerals';

/**
 * Renders a Gregorian `Date` as the Jalali (Persian/Shamsi) text an operator reads — the app is a
 * Persian-language product (`../../../../CLAUDE.md`'s "Cablan is a Persian-language product"), so
 * the report tables, the audit-log dialog and the Excel export all show `1403/04/01 08:30` while the
 * API's instants stay plain ISO.
 *
 * There is no matching parser here any more, and that is the point: text typed into a date filter is
 * parsed by Material's own `DateAdapter` (`core/material/jalali-date-adapter.ts`), which is what the
 * calendar and clock in `ui/jalali-datetime-field` read and write through. This module used to carry
 * a vendored copy of the `jalaali-js` algorithm for both directions; it was replaced once the app
 * depended on `date-fns-jalali` anyway, because two implementations of one calendar in a single
 * bundle is one too many — and the picker's is the one that decides what the user clicks.
 *
 * Two renderings, differing only in their digits. `formatJalaliDateTime` writes Persian numerals,
 * because that is what a Persian reader reads and what the calendar grid already shows.
 * `formatJalaliDateTimeInLatinDigits` writes `1403/04/01 08:30`, and exists for spreadsheet cells:
 * a cell reading `۱۴۰۳` is text rather than a date to anything that opens the file, which
 * `features/boms/bom-report-export.ts` depends on.
 *
 * The digit swap is `toPersianDigits`, never a number formatter — `1403` is a year, not one
 * thousand four hundred and three, and grouping it would produce `۱٬۴۰۳`.
 *
 * The time of day is the **viewer's own**, not UTC. That is `date-fns`' native behaviour and it is
 * the intended one: an operator in Tehran who reads `08:30` is reading half past eight where they
 * are standing. This reverses an earlier UTC convention, under which a BOM registered at 10:00
 * Tehran time displayed as 06:30.
 */
export const formatJalaliDateTimeInLatinDigits = (date: Date): string =>
  format(date, 'yyyy/MM/dd HH:mm');

export const formatJalaliDateTime = (date: Date): string =>
  toPersianDigits(formatJalaliDateTimeInLatinDigits(date));
