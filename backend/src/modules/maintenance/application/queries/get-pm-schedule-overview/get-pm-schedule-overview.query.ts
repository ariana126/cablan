import { PmScheduleFilters } from '@maintenance/application/service/pm-occurrence-finder';

/**
 * The PM schedule's table: the occurrences due in `[from, to]`. Either bound
 * may be missing here; the handler refuses that as `InvalidPmScheduleRange`.
 */
export class GetPmScheduleOverviewQuery {
  constructor(
    /** ISO `YYYY-MM-DD`. */
    public readonly from: string | undefined,
    /** ISO `YYYY-MM-DD`. */
    public readonly to: string | undefined,
    public readonly filters: PmScheduleFilters = {},
  ) {}
}
