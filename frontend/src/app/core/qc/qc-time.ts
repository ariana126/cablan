import { formatTehranJalaliDateTime } from '../date/jalali-datetime';

/** What a QC fact shows for a time that is not there, as the other report pages do. */
export const NO_TIME = '—';

/** What «آخرین انجام» says for an activity never recorded on the equipment. */
export const NO_EXECUTION = 'بدون سابقه';

/**
 * A QC record's instant as Jalali date and `HH:mm` on **Tehran's** wall clock (issue #119): the
 * business states QC times in factory time, whatever the browser's own zone — as the PM folder does
 * for a deactivation. `null` or unreadable text is `NO_TIME`.
 */
export function qcTime(iso: string | null): string {
  if (iso === null || Number.isNaN(new Date(iso).getTime())) {
    return NO_TIME;
  }
  return formatTehranJalaliDateTime(iso);
}

/** «آخرین انجام» of a QC activity on an equipment: its time as `qcTime`, or «بدون سابقه». */
export function qcLastExecution(lastPerformedAt: string | null): string {
  return lastPerformedAt === null ? NO_EXECUTION : qcTime(lastPerformedAt);
}
