import { addDays } from 'date-fns';

import { ActivitySpecialty } from '../../core/i18n/specialty-labels';
import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppMaintenanceExecution } from '../../core/maintenance/equipment-gateway';

/**
 * «سابقه PM»'s filters (issue #112), applied in the browser over the history the section already
 * read in full. `''` specialty is «همه»; a `null` bound is open.
 */
export interface HistoryFilter {
  readonly query: string;
  readonly specialty: ActivitySpecialty | '';
  /** A local midnight, as the date-only field writes it — the first day kept. */
  readonly from: Date | null;
  /** A local midnight — the last day kept, all of it. */
  readonly to: Date | null;
}

export const NO_HISTORY_FILTER: HistoryFilter = { query: '', specialty: '', from: null, to: null };

/**
 * The executions that match every filter, in the order given. The range is on when the work was
 * done (`performedAt`), by the viewer's own days — the ones the «زمان انجام» column shows.
 */
export const filterHistory = (
  executions: readonly AppMaintenanceExecution[],
  filter: HistoryFilter,
): AppMaintenanceExecution[] => {
  const from = filter.from?.getTime() ?? Number.NEGATIVE_INFINITY;
  const until = filter.to === null ? Number.POSITIVE_INFINITY : addDays(filter.to, 1).getTime();
  return executions.filter((execution) => {
    const performed = new Date(execution.performedAt).getTime();
    return (
      matchesSearch(execution.activityName, filter.query) &&
      (filter.specialty === '' || execution.activitySpecialty === filter.specialty) &&
      (filter.from === null && filter.to === null ? true : performed >= from && performed < until)
    );
  });
};
