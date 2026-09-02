import { format } from 'date-fns-jalali';

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
 * Digits stay ASCII. The default locale used here supplies no Persian-Indic numerals, which is what
 * `features/boms/bom-report-export.ts` depends on: a spreadsheet cell reading `۱۴۰۳` is text rather
 * than a date to anything that opens the file. (The calendar grid does show Persian numerals — that
 * is the `fa-IR` locale the adapter switches to, and it is the right convention for a calendar.)
 *
 * The time of day is the **viewer's own**, not UTC. That is `date-fns`' native behaviour and it is
 * the intended one: an operator in Tehran who reads `08:30` is reading half past eight where they
 * are standing. This reverses an earlier UTC convention, under which a BOM registered at 10:00
 * Tehran time displayed as 06:30.
 */
export const formatJalaliDateTime = (date: Date): string => format(date, 'yyyy/MM/dd HH:mm');
