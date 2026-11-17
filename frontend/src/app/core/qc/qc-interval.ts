import { formatPersianNumber } from '../i18n/persian-numerals';

/** What a QC record shows when it is the first of its activity on its equipment. */
export const NO_PREVIOUS_EXECUTION = 'بدون سابقه قبلی';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * The time since the previous record of the same activity on the same equipment (issue #119), as
 * the API's whole `intervalMinutes`: its non-zero day, hour and minute parts joined by « و » —
 * «۱ روز و ۳ ساعت و ۲۰ دقیقه», «۲ ساعت» — and «۰ دقیقه» for two records in the same minute.
 *
 * Each part is a quantity a visitor reads, so it is in Persian digits (`formatPersianNumber`), as
 * «مقدار تاخیر» («۲ روز») is on the PM pages. `null` (no earlier record) is `NO_PREVIOUS_EXECUTION`.
 */
export function formatQcInterval(intervalMinutes: number | null): string {
  if (intervalMinutes === null) {
    return NO_PREVIOUS_EXECUTION;
  }
  const days = Math.floor(intervalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((intervalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = intervalMinutes % MINUTES_PER_HOUR;
  const parts = [
    [days, 'روز'],
    [hours, 'ساعت'],
    [minutes, 'دقیقه'],
  ] as const;
  const shown = parts
    .filter(([amount]) => amount > 0)
    .map(([amount, unit]) => `${formatPersianNumber(amount)} ${unit}`);
  return shown.length > 0 ? shown.join(' و ') : `${formatPersianNumber(0)} دقیقه`;
}
