const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Latin digits swapped for Persian ones, leaving every other character untouched. Every quantity
 * the frontend renders — a weight, a score, a standard length, a total — goes through its own
 * `toPersianDigits`/`persianNumber` pipe (`frontend/src/app/core/i18n/persian-numerals.ts`), so a
 * Gherkin literal like `"10"` never matches the rendered `"۱۰"` without the same conversion applied
 * here first. Reimplemented rather than imported: this suite never reaches into `frontend/` for
 * anything (`../../../CLAUDE.md`'s one-way dependency rule), the same reason
 * `screenplay/common/jalali-datetime.ts` carries its own Jalali conversion instead of importing
 * `date-fns-jalali`.
 *
 * Not for identifiers or free text — order numbers, tracking numbers, MI codes and descriptions
 * keep Latin digits on screen (the frontend's own module comment explains why), so this is applied
 * only at the specific call sites that compare a rendered *quantity*, never blanket over every
 * expected string a step receives.
 */
export const toPersianDigits = (text: string): string =>
  text.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
