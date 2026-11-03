import { formatPersianNumber } from './persian-numerals';

/** A recording that gave no operating hours (issue #108) — zero is a reading, an absence is not. */
export const NO_OPERATING_HOURS = 'ثبت نشده';

/** «ساعت کارکرد دستگاه» of a recorded execution: «۱٬۲۵۰٫۵ ساعت», or «ثبت نشده». */
export const operatingHoursLabel = (hours: number | null): string =>
  hours === null ? NO_OPERATING_HOURS : `${formatPersianNumber(hours)} ساعت`;
