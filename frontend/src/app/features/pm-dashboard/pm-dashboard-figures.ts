import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { formatPersianNumber } from '../../core/i18n/persian-numerals';

/**
 * How the dashboard words its figures — one place, so a card, a panel, the trend's text and the
 * follow-up chip all read alike.
 */

/** A performance percentage with nothing past due to judge it by (the approved Gherkin's words). */
export const NOT_ENOUGH_DATA = 'داده کافی وجود ندارد';

/** Coverage with no active equipment: not zero, simply nothing to cover. */
const NO_COVERAGE = '—';

/** No late work in the period, so no average delay — the same hyphen as «مقدار تاخیر». */
const NO_AVERAGE_DELAY = '-';

const percent = (value: number): string => `${formatPersianNumber(value)}٪`;

/** «۷۰٪», or «داده کافی وجود ندارد». */
export const performancePercentLabel = (value: number | null): string =>
  value === null ? NOT_ENOUGH_DATA : percent(value);

/** «۵۰٪», or «—» when no equipment is active. */
export const coveragePercentLabel = (value: number | null): string =>
  value === null ? NO_COVERAGE : percent(value);

/**
 * «۳ روز», «۳٫۵ روز» — one decimal at most, none when whole (the API already rounds; this only
 * guards against a longer float), or «-».
 */
export const averageDaysLateLabel = (value: number | null): string =>
  value === null ? NO_AVERAGE_DELAY : `${formatPersianNumber(Math.round(value * 10) / 10)} روز`;

/** A trend point's stretch of time: one Jalali day, or «from تا to». */
export const trendRangeLabel = (range: { readonly from: string; readonly to: string }): string =>
  range.from === range.to
    ? formatJalaliCalendarDate(range.from)
    : `${formatJalaliCalendarDate(range.from)} تا ${formatJalaliCalendarDate(range.to)}`;
