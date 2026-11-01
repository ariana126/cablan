import { PmScheduleFilters } from '@maintenance/application/service/pm-occurrence-finder';

/**
 * The PM schedule's calendar: the occurrences whose calendar date is in
 * `[from, to]`. Either bound may be missing here; the handler refuses that
 * as `InvalidPmScheduleRange`.
 */
export class GetPmScheduleCalendarQuery {
  constructor(
    /** ISO `YYYY-MM-DD`. */
    public readonly from: string | undefined,
    /** ISO `YYYY-MM-DD`. */
    public readonly to: string | undefined,
    public readonly filters: PmScheduleFilters = {},
  ) {}
}
