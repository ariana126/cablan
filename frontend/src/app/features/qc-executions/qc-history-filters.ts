import { tehranDayEnd, tehranDayStart } from '../../core/date/tehran-day-bounds';
import { AppQcExecutionFilters } from '../../core/qc/qc-executions-gateway';

/**
 * What the QC records' filters hold (issue #119). `''` is «همه» for the three pickers; `from`/`to`
 * are the days the date-only fields wrote (local midnights), `null` while open.
 */
export interface QcHistoryFilter {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly equipmentId: string;
  readonly activityId: string;
  readonly performedById: string;
  readonly trackingNumber: string;
}

export const NO_QC_HISTORY_FILTER: QcHistoryFilter = {
  from: null,
  to: null,
  equipmentId: '',
  activityId: '',
  performedById: '',
  trackingNumber: '',
};

/**
 * The filters as the API takes them: each day of the range as the whole **Tehran** day (records are
 * shown on Tehran's clock, so a day means the same on both sides), every blank one left off.
 */
export function toQcExecutionFilters(filter: QcHistoryFilter): AppQcExecutionFilters {
  const trackingNumber = filter.trackingNumber.trim();
  const entries: [keyof AppQcExecutionFilters, string | undefined][] = [
    ['from', filter.from === null ? undefined : tehranDayStart(filter.from)],
    ['to', filter.to === null ? undefined : tehranDayEnd(filter.to)],
    ['equipmentId', filter.equipmentId],
    ['activityId', filter.activityId],
    ['performedById', filter.performedById],
    ['trackingNumber', trackingNumber],
  ];
  return Object.fromEntries(
    entries.filter(([, value]) => value !== undefined && value !== ''),
  ) as AppQcExecutionFilters;
}
