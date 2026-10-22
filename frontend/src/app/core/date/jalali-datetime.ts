import { format } from 'date-fns-jalali';

import { toPersianDigits } from '../i18n/persian-numerals';

/**
 * Renders a Gregorian `Date` as the Jalali (Persian/Shamsi) text an operator reads — the app is a
 * Persian-language product (`../../../../CLAUDE.md`'s "Cablan is a Persian-language product"), so
 * the report tables and the audit-log dialog show `۱۴۰۳/۰۴/۰۱ ۰۸:۳۰` while the API's instants stay
 * plain ISO. (The Excel exports are built by the API, which formats the same way in the time zone
 * the browser sends it.)
 *
 * There is no matching parser here any more, and that is the point: the date filters take no typing,
 * and the calendar and clock in `ui/jalali-datetime-field` read and write through Material's own
 * `DateAdapter` (`core/material/jalali-date-adapter.ts`). This module used to carry
 * a vendored copy of the `jalaali-js` algorithm for both directions; it was replaced once the app
 * depended on `date-fns-jalali` anyway, because two implementations of one calendar in a single
 * bundle is one too many — and the picker's is the one that decides what the user clicks.
 *
 * It writes Persian numerals, because that is what a Persian reader reads and what the calendar
 * grid already shows. The digit swap is `toPersianDigits`, never a number formatter — `1403` is a
 * year, not one thousand four hundred and three, and grouping it would produce `۱٬۴۰۳`.
 *
 * The time of day is the **viewer's own**, not UTC. That is `date-fns`' native behaviour and it is
 * the intended one: an operator in Tehran who reads `08:30` is reading half past eight where they
 * are standing. This reverses an earlier UTC convention, under which a BOM registered at 10:00
 * Tehran time displayed as 06:30.
 */
export const formatJalaliDateTime = (date: Date): string =>
  toPersianDigits(format(date, 'yyyy/MM/dd HH:mm'));
