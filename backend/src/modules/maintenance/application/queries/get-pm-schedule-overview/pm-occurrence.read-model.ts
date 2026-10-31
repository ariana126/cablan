/** One occurrence of an active plan item, as it stands today. */
export class PmOccurrenceReadModel {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityName: string,
    /** ISO `YYYY-MM-DD`. */
    public readonly dueDate: string,
    /** A `PmOccurrenceStatus` value: on_time, late, missed, overdue, due or upcoming. */
    public readonly status: string,
    /** ISO-8601 instant, or `null` while not done. */
    public readonly performedAt: string | null,
    /** The performer's display name when it was done, or `null`. */
    public readonly performedBy: string | null,
    /** Whole Tehran days after the due date it was done, or `null` unless `late`. */
    public readonly daysLate: number | null,
  ) {}
}
