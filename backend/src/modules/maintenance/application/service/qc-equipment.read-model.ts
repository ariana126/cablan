/** A QC activity assigned to a piece of equipment, and when it was last done there. */
export interface QcActivityStatusReadModel {
  readonly activityId: string;
  /** Its current name. */
  readonly activityName: string;
  /** ISO instant of its latest record on this equipment, ever, or `null` («بدون سابقه»). */
  readonly lastPerformedAt: string | null;
}

/**
 * A piece of equipment with its QC activities — the folder's first section
 * and the inspection view alike.
 */
export interface QcEquipmentReadModel {
  readonly id: string;
  /** Its current name. */
  readonly name: string;
  readonly retired: boolean;
  /** The activities assigned to it now, by Persian name. */
  readonly activities: QcActivityStatusReadModel[];
}
