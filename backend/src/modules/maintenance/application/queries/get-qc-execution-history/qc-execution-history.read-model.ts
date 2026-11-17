/** One QC record, as both the folder and the plant-wide records show it. */
export interface QcExecutionReadModel {
  readonly id: string;
  readonly equipmentId: string;
  /** The equipment's current name. */
  readonly equipmentName: string;
  readonly activityId: string;
  /** The activity's current name. */
  readonly activityName: string;
  readonly performedById: string;
  readonly performedByName: string;
  /** ISO instant. */
  readonly performedAt: string;
  readonly trackingNumber: string;
  readonly notes: string | null;
  /**
   * ISO instant of the previous record of the same equipment and activity,
   * over every record whatever the filters, or `null` for the first.
   */
  readonly previousPerformedAt: string | null;
  /** Whole minutes since that previous record, floored, or `null` for the first. */
  readonly intervalMinutes: number | null;
}

/** How many records of one activity on one piece of equipment the filters admit. */
export interface QcExecutionCountReadModel {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly count: number;
}

export interface QcExecutionHistoryReadModel {
  /** Newest first. */
  readonly executions: QcExecutionReadModel[];
  /** By equipment name, then activity name. */
  readonly counts: QcExecutionCountReadModel[];
}
