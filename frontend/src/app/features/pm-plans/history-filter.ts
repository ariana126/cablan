import { toIsoCalendarDate } from '../../core/date/calendar-date';
import { ActivitySpecialty } from '../../core/i18n/specialty-labels';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import {
  AppMaintenanceHistoryEntry,
  MaintenanceHistoryRange,
} from '../../core/maintenance/equipment-gateway';

/**
 * «سابقه PM»'s name search and «تخصص» (issue #112), applied in the browser over the history the
 * section read — to work done and missed due dates alike. `''` specialty is «همه». The date range
 * is not here: since issue #114 it goes to the API (`historyRange`), which alone knows that work
 * is placed by the day it was done and a missed occurrence by its due date.
 */
export interface HistoryFilter {
  readonly query: string;
  readonly specialty: ActivitySpecialty | '';
}

export const NO_HISTORY_FILTER: HistoryFilter = { query: '', specialty: '' };

/** The entries that match both filters, in the order given. */
export const filterHistory = (
  entries: readonly AppMaintenanceHistoryEntry[],
  filter: HistoryFilter,
): AppMaintenanceHistoryEntry[] =>
  entries.filter(
    (entry) =>
      matchesSearch(entry.activityName, filter.query) &&
      (filter.specialty === '' || entry.activitySpecialty === filter.specialty),
  );

/** The earliest and latest days the API accepts as a bound. */
const EARLIEST_DAY = '2000-01-01';
const LATEST_DAY = '2100-12-31';

/**
 * The range to ask the API for, from «از تاریخ» / «تا تاریخ» (local midnights, as the date-only
 * fields write them): `undefined` while neither is chosen. The API takes both bounds or neither,
 * so an open end is closed at the furthest day it accepts.
 */
export function historyRange(
  from: Date | null,
  to: Date | null,
): MaintenanceHistoryRange | undefined {
  if (from === null && to === null) {
    return undefined;
  }
  return {
    from: from === null ? EARLIEST_DAY : toIsoCalendarDate(from),
    to: to === null ? LATEST_DAY : toIsoCalendarDate(to),
  };
}
