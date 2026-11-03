import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';

export class PmPlanItemReadModel {
  constructor(
    public readonly id: string,
    public readonly activityId: string,
    /** The activity's current name. */
    public readonly activityName: string,
    /** The activity's current specialty, `electrical` or `mechanical`, or `null` while it has none. */
    public readonly activitySpecialty: ActivitySpecialtyValue | null,
    /** The interval now in force. */
    public readonly intervalDays: number,
    /** ISO `YYYY-MM-DD`. */
    public readonly firstDueDate: string,
    /** ISO `YYYY-MM-DD` — the occurrence an execution recorded today would be for. */
    public readonly nextDueDate: string,
  ) {}
}
