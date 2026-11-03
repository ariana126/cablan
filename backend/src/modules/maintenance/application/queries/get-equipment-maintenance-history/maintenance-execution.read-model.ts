import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';

export type MaintenanceExecutionStatus = 'on_time' | 'late';

/** One job done, as the history shows it — never rewritten by a later plan change. */
export class MaintenanceExecutionReadModel {
  constructor(
    public readonly id: string,
    /** The activity's name when the job was recorded. */
    public readonly activityName: string,
    /** ISO `YYYY-MM-DD` — the occurrence it was recorded for. */
    public readonly dueDate: string,
    /** ISO-8601 instant. */
    public readonly performedAt: string,
    /** The performer's display name when it was recorded. */
    public readonly performedBy: string,
    public readonly status: MaintenanceExecutionStatus,
    public readonly notes: string | null,
    /** Whole Tehran days after the due date it was done, or `null` when on time. */
    public readonly daysLate: number | null,
    /**
     * The activity's specialty as the catalog has it now — it can no longer
     * change once a PM plan holds the activity — or `null` while it has none.
     */
    public readonly activitySpecialty: ActivitySpecialtyValue | null,
    /** The equipment's operating hours the performer reported, or `null` («ثبت نشده», never 0). */
    public readonly operatingHours: number | null,
  ) {}
}
