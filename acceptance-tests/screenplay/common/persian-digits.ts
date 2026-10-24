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

/**
 * The reverse direction: a quantity as the frontend *renders* it, brought back to the plain Latin
 * notation a Gherkin literal is written in (`"-1.5"`, `"0"`, `"12"`), so a step can compare a signed
 * or fractional value without predicting the exact Persian rendering character by character.
 *
 * The frontend formats quantities with `Intl.NumberFormat('fa-IR')`, which renders `-1.5` as
 * `‎−۱٫۵` — a U+200E LEFT-TO-RIGHT MARK, a U+2212 MINUS SIGN, Persian digits and the Persian decimal
 * separator `٫`. Each of those is undone here: Persian (and Arabic-Indic) digits become Latin, `٫`
 * becomes `.`, the grouping separator `٬` is dropped, every minus-like character becomes `-`, and
 * every bidi control mark is removed. `-0` collapses to `0` so a signed zero never fails on a sign.
 */
export const fromRenderedNumber = (text: string): string => {
  const normalized = text
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, '')
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .replace(/[−‒–—﹣－]/g, '-')
    .trim();
  return normalized === '-0' ? '0' : normalized;
};

/**
 * Persian (`۰–۹`) and Arabic-Indic (`٠–٩`) digits swapped for Latin ones, every other character
 * untouched — the system's own rule for identifiers and free text: «۱۲۳۴» and «1234» are the same
 * value for uniqueness, lookup and search (issue #62).
 *
 * Used only where the suite itself has to apply that sameness: an invariant such as "no two
 * standard BOMs share this MI code", which must treat a Persian-digit attempt and its Latin-digit
 * twin as one value, or finding which fixture a Persian-digit step refers to. Never to massage an
 * expected value before comparing it with what the system stored — the specs state the stored
 * (Latin) value explicitly, and that is what is compared.
 */
export const withLatinDigits = (text: string): string =>
  text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
