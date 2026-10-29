import { PmScheduleControllerOverview200ItemStatus } from '../../api/model';

/** Every status a PM occurrence can have: the overview's set, which the daily list and history share. */
export type PmOccurrenceStatus = PmScheduleControllerOverview200ItemStatus;

/**
 * One vocabulary for the daily list, the overview and the history, so «عقب افتاده» means the same
 * on every page. `upcoming` is «آینده» — the word the approved Gherkin uses for work not yet due.
 */
export const PM_STATUS_LABELS: Readonly<Record<PmOccurrenceStatus, string>> = {
  on_time: 'بموقع',
  late: 'با تاخیر',
  missed: 'انجام نشده',
  overdue: 'عقب افتاده',
  due: 'سررسیده',
  upcoming: 'آینده',
};
