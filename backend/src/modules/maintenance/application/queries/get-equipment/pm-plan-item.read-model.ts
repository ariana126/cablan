export class PmPlanItemReadModel {
  constructor(
    public readonly id: string,
    public readonly activityId: string,
    /** The activity's current name. */
    public readonly activityName: string,
    /** The interval now in force. */
    public readonly intervalDays: number,
    /** ISO `YYYY-MM-DD`. */
    public readonly firstDueDate: string,
    /** ISO `YYYY-MM-DD` — the occurrence an execution recorded today would be for. */
    public readonly nextDueDate: string,
  ) {}
}
