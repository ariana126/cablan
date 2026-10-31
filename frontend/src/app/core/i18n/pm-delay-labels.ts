import { formatPersianNumber } from './persian-numerals';

/**
 * What «مقدار تاخیر» shows when an occurrence was not late: a plain hyphen — never blank — as the
 * approval vocabulary's missing values are, not the em dash used for "not yet".
 */
export const NO_DELAY = '-';

/**
 * «مقدار تاخیر» for a PM occurrence, one wording for the overview and the history: the API's
 * `daysLate` (a positive whole number only when the work was done late) as «N روز».
 */
export const pmDelayLabel = (daysLate: number | null): string =>
  daysLate === null ? NO_DELAY : `${formatPersianNumber(daysLate)} روز`;
