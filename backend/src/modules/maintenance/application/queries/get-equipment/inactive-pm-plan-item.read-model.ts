/** A deactivated row of an equipment's PM plan, read-only: it never takes work again. */
export class InactivePmPlanItemReadModel {
  constructor(
    public readonly id: string,
    public readonly activityId: string,
    /** The activity's current name. */
    public readonly activityName: string,
    /** The interval of its schedule's last segment — the last one it was planned with. */
    public readonly intervalDays: number,
    /** ISO `YYYY-MM-DD`. */
    public readonly firstDueDate: string,
    /** ISO instant. */
    public readonly deactivatedAt: string,
  ) {}
}
