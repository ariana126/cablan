import { NamedPmPlanItem } from '@maintenance/application/service/pm-plan-reader';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import {
  ExecutedOccurrence,
  PmOccurrence,
} from '@maintenance/domain/pm-occurrences';
import { ActivitySpecialtyValue } from '@maintenance/domain/value/activity-specialty.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';

/** A job done, or an occurrence nobody did in time (issue #114). */
export type MaintenanceHistoryEntryKind = 'executed' | 'missed';

/** `on_time`/`late` for a job done, `missed` for an occurrence not done by its next due date. */
export type MaintenanceHistoryEntryStatus =
  | PmOccurrenceStatus.OnTime
  | PmOccurrenceStatus.Late
  | PmOccurrenceStatus.Missed;

/**
 * One entry of an equipment's PM history: a job done — never rewritten by a
 * later plan change — or an occurrence that turned `missed`, computed as of
 * today and never stored. Built only through `executed()` or `missed()`, so
 * an entry cannot mix the two: a missed one has no execution, and its `id`,
 * `performedAt`, `performedBy`, `notes`, `daysLate` and `operatingHours` are
 * `null`.
 */
export class MaintenanceHistoryEntryReadModel {
  private constructor(
    public readonly kind: MaintenanceHistoryEntryKind,
    /** The execution's id; `null` when missed. */
    public readonly id: string | null,
    /** The PM plan row it belongs to (issue #110). */
    public readonly planItemId: string,
    /**
     * The activity's name when the job was recorded; for a missed
     * occurrence, its current name.
     */
    public readonly activityName: string,
    /**
     * The activity's specialty as the catalog has it now — it can no longer
     * change once a PM plan holds the activity — or `null` while it has none.
     */
    public readonly activitySpecialty: ActivitySpecialtyValue | null,
    /** ISO `YYYY-MM-DD` — the occurrence's due date. */
    public readonly dueDate: string,
    /** ISO-8601 instant; `null` when missed. */
    public readonly performedAt: string | null,
    /** The performer's display name when it was recorded; `null` when missed. */
    public readonly performedBy: string | null,
    public readonly status: MaintenanceHistoryEntryStatus,
    public readonly notes: string | null,
    /** Whole Tehran days after the due date it was done, or `null` unless late. */
    public readonly daysLate: number | null,
    /** The equipment's operating hours the performer reported, or `null` («ثبت نشده», never 0). */
    public readonly operatingHours: number | null,
  ) {}

  /** A job done, as recorded, with its activity's current specialty. */
  static executed(
    execution: MaintenanceExecution,
    activitySpecialty: ActivitySpecialtyValue | null,
  ): MaintenanceHistoryEntryReadModel {
    return new MaintenanceHistoryEntryReadModel(
      'executed',
      execution.id.asString(),
      execution.planItemId().asString(),
      execution.activityName(),
      activitySpecialty,
      execution.dueDate().asString(),
      execution.performedAt().toISOString(),
      execution.performedByName(),
      execution.status(),
      execution.notes(),
      execution.daysLate(),
      execution.operatingHours()?.asNumber() ?? null,
    );
  }

  /**
   * An occurrence of `planItem` that turned `missed`, under its activity's
   * current name and specialty. Any other occurrence is refused: the history
   * never shows one that is due, overdue or upcoming.
   */
  static missed<E extends ExecutedOccurrence>(
    planItem: NamedPmPlanItem,
    occurrence: PmOccurrence<E>,
  ): MaintenanceHistoryEntryReadModel {
    const { status } = occurrence;
    if (status !== PmOccurrenceStatus.Missed) {
      throw new Error(
        `The occurrence due ${occurrence.dueDate.asString()} is ${status}, not missed`,
      );
    }
    return new MaintenanceHistoryEntryReadModel(
      'missed',
      null,
      planItem.item.id.asString(),
      planItem.activityName,
      planItem.activitySpecialty,
      occurrence.dueDate.asString(),
      null,
      null,
      status,
      null,
      null,
      null,
    );
  }
}
