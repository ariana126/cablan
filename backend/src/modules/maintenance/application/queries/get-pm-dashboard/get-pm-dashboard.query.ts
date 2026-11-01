/**
 * The technical management dashboard over the last `periodDays` days (7, 30
 * or 90, today included), for every piece of equipment or for one. Coverage
 * is always plant-wide.
 */
export class GetPmDashboardQuery {
  constructor(
    public readonly periodDays: number,
    /** A piece of equipment's id; every piece when absent. */
    public readonly equipmentId?: string,
  ) {}
}
