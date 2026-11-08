import { AppEquipmentDetail } from '../../core/maintenance/equipment-gateway';

/** The facts at the top of an equipment's folder (issue #112), counted from its own plan. */
export interface FolderSummary {
  /** Rows in the PM plan now — deactivated ones are not. */
  readonly activeItemCount: number;
  /** Rows whose next due date has passed undone. */
  readonly overdueCount: number;
  /** The earliest next due date, ISO `YYYY-MM-DD`; `null` when nothing is due. */
  readonly nearestDueDate: string | null;
}

/**
 * Sums up a folder from the equipment the page already read — no request of its own (issue #112).
 *
 * A row's `nextDueDate` is the API's: the earliest occurrence from the current one on that has no
 * execution yet. One before today is therefore an occurrence past its due date and not done — the
 * daily list's «عقب افتاده»; today's is «سررسیده», not overdue. `today` is the Tehran calendar day
 * (`tehranToday()`), the same day the API counts by. A retired equipment's PM is stopped while it is
 * retired, so nothing on it is overdue or due.
 *
 * ISO calendar dates compare correctly as strings, so no `Date` is built from one.
 */
export const folderSummary = (equipment: AppEquipmentDetail, today: string): FolderSummary => {
  const items = equipment.planItems;
  if (equipment.retired || items.length === 0) {
    return { activeItemCount: items.length, overdueCount: 0, nearestDueDate: null };
  }
  const dueDates = items.map((item) => item.nextDueDate).filter((date) => date !== '');
  return {
    activeItemCount: items.length,
    overdueCount: dueDates.filter((date) => date < today).length,
    nearestDueDate: dueDates.length === 0 ? null : dueDates.reduce((a, b) => (b < a ? b : a)),
  };
};
