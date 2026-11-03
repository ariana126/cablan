import { formatPersianNumber, toLatinDigits } from '../../core/i18n/persian-numerals';

/** The API's ceiling: `operatingHours` ≤ 1,000,000. */
const MAX_OPERATING_HOURS = 1_000_000;

/** A whole number, or one with one or two decimals — no sign, no exponent, no grouping. */
const READING = /^\d+(\.\d{1,2})?$/;

/** Also what the field says when the API refuses the value. */
export const OPERATING_HOURS_MALFORMED =
  'ساعت کارکرد باید عددی صفر یا بیشتر با حداکثر دو رقم اعشار باشد.';
const TOO_LARGE = `ساعت کارکرد نمی‌تواند بیشتر از ${formatPersianNumber(MAX_OPERATING_HOURS)} باشد.`;

/** Persian or Arabic-Indic digits and the Persian decimal mark («٫») read as Latin. */
const normalised = (text: string): string => toLatinDigits(text.trim()).replace(/٫/g, '.');

/**
 * The record dialog's «ساعت کارکرد دستگاه» as typed (issue #108): `null` when left empty (nothing
 * is sent), the number of hours, or `undefined` when it is not a reading the API takes — text
 * («دوازده»), a negative, more than two decimals, or over 1,000,000. Typed into a text input on
 * purpose: a number input would silently drop «دوازده» and the visitor would never be told why.
 */
export const parseOperatingHours = (text: string): number | null | undefined => {
  const value = normalised(text);
  if (value === '') {
    return null;
  }
  if (!READING.test(value)) {
    return undefined;
  }
  const hours = Number(value);
  return hours <= MAX_OPERATING_HOURS ? hours : undefined;
};

/** What the field says when it cannot be sent; `undefined` when it can (empty included). */
export const operatingHoursError = (text: string): string | undefined => {
  if (parseOperatingHours(text) !== undefined) {
    return undefined;
  }
  return READING.test(normalised(text)) ? TOO_LARGE : OPERATING_HOURS_MALFORMED;
};
