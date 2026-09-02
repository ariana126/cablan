/**
 * Persian-Indic numerals for everything a visitor *reads*.
 *
 * Cablan is a Persian-language product (`../../../../CLAUDE.md`), and `۱۲۳` is how a number is
 * written in Persian. Two functions, because there are two different jobs:
 *
 * - `formatPersianNumber` takes a `number` and produces the whole Persian rendering — digits,
 *   grouping (`٬`) and decimal mark (`٫`) — so `1234.5` reads `۱٬۲۳۴٫۵`.
 * - `toPersianDigits` swaps digits inside an already-formatted string and touches nothing else, for
 *   text that is not a quantity and must not be regrouped. A Jalali date is the reason it exists:
 *   `1403/04/01` is a date, not one thousand four hundred and three, and running it through a number
 *   formatter would render it `۱٬۴۰۳/۰۴/۰۱`.
 *
 * **`Intl`, not Angular's `DecimalPipe`.** The obvious move — `registerLocaleData(localeFa)` plus
 * `LOCALE_ID: 'fa'` — does not work: Angular's number formatting localises separators only and
 * emits Latin digits regardless of locale, so `DecimalPipe` under `fa` returns `1,234.5`. The
 * platform's own `Intl.NumberFormat('fa-IR')` is what knows the `arabext` numbering system. There
 * is deliberately no `LOCALE_ID` provider in `app.config.ts`; adding one would look like it was
 * doing this work and would in fact do nothing.
 *
 * **What is deliberately not converted.** Identifiers keep Latin digits everywhere — order numbers
 * (`ORD-5001`), tracking numbers, MI codes and record UUIDs. `ORD-۵۰۰۱` reads as neither one thing
 * nor the other, a UUID with Persian digits no longer matches the value the backend holds, and an
 * operator searching for a code needs to see what they will type. Spreadsheet cells keep Latin
 * digits too — see `formatJalaliDateTimeInLatinDigits` in `../date/jalali-datetime.ts`.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Built once: constructing an `Intl.NumberFormat` is the expensive part, and a table redraws it per
 * cell. */
const persianNumberFormat = new Intl.NumberFormat('fa-IR');

/** A quantity, as Persian reads it — digits, grouping and decimal mark together. */
export const formatPersianNumber = (value: number): string =>
  Number.isFinite(value) ? persianNumberFormat.format(value) : '';

/** Latin digits swapped for Persian ones, leaving every other character — separators, letters,
 * punctuation — exactly where it was. */
export const toPersianDigits = (text: string): string =>
  text.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
