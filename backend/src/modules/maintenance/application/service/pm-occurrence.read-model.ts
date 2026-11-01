/**
 * One occurrence of a plan item as it stands today — a row of the PM
 * schedule's table and calendar. Deactivated items and retired equipment are
 * included up to the day they stopped.
 */
export class PmOccurrenceReadModel {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly equipmentRetired: boolean;
  readonly planItemId: string;
  readonly activityId: string;
  /** The activity's current catalog name. */
  readonly activityName: string;
  /** ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
  /** ISO `YYYY-MM-DD`: the Tehran date it was performed when `late`, else `dueDate`. */
  readonly calendarDate: string;
  /** A `PmOccurrenceStatus` value: on_time, late, missed, overdue, due or upcoming. */
  readonly status: string;
  /** ISO-8601 instant, or `null` while not done. */
  readonly performedAt: string | null;
  /** The performer's user id, or `null` while not done. */
  readonly performedById: string | null;
  /** The performer's display name when it was done, or `null`. */
  readonly performedBy: string | null;
  /** Whole Tehran days after the due date it was done, or `null` unless `late`. */
  readonly daysLate: number | null;
  /** What the performer noted, or `null`. */
  readonly notes: string | null;

  constructor(fields: PmOccurrenceReadModel) {
    this.equipmentId = fields.equipmentId;
    this.equipmentName = fields.equipmentName;
    this.equipmentRetired = fields.equipmentRetired;
    this.planItemId = fields.planItemId;
    this.activityId = fields.activityId;
    this.activityName = fields.activityName;
    this.dueDate = fields.dueDate;
    this.calendarDate = fields.calendarDate;
    this.status = fields.status;
    this.performedAt = fields.performedAt;
    this.performedById = fields.performedById;
    this.performedBy = fields.performedBy;
    this.daysLate = fields.daysLate;
    this.notes = fields.notes;
  }
}
