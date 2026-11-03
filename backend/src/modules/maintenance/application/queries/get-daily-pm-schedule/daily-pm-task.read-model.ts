import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';

export type DailyPmTaskStatus = 'due' | 'overdue';

/** One job on today's PM list: an active item's current occurrence, not yet done. */
export class DailyPmTaskReadModel {
  constructor(
    public readonly equipmentId: string,
    public readonly equipmentName: string,
    public readonly planItemId: string,
    public readonly activityId: string,
    public readonly activityName: string,
    /** The activity's current specialty, `electrical` or `mechanical`, or `null` while it has none. */
    public readonly activitySpecialty: ActivitySpecialtyValue | null,
    /** ISO `YYYY-MM-DD`. */
    public readonly dueDate: string,
    public readonly status: DailyPmTaskStatus,
    /** Days since the due date; `0` when due today. */
    public readonly daysOverdue: number,
  ) {}
}
