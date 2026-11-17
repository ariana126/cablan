import { Identity } from '@framework/domain';

import { QcExecutionFilter } from './qc-execution-filter';

/**
 * One QC record as the reads show it: its equipment's and activity's
 * **current** names (a correction shows everywhere at once), and when the
 * record of the same equipment and activity just before it was made.
 */
export interface QcExecutionRow {
  readonly id: string;
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly activityId: string;
  readonly activityName: string;
  readonly performedById: string;
  /** The performer's name when recorded. */
  readonly performedByName: string;
  readonly performedAt: Date;
  readonly trackingNumber: string;
  readonly notes: string | null;
  /**
   * When the previous record of the same equipment and activity was made —
   * over **every** record, whatever the filter, unassignments and
   * reassignments included — or `null` for the first.
   */
  readonly previousPerformedAt: Date | null;
}

/** The latest record of one activity on one piece of equipment. */
export interface LastQcExecution {
  readonly equipmentId: string;
  readonly activityId: string;
  readonly performedAt: Date;
}

/** Someone who made a QC record, named as in their latest one. */
export interface QcPerformer {
  readonly id: string;
  readonly name: string;
}

/**
 * The read side of the QC records (issue #119). Not the write repository:
 * every read joins the current equipment and activity names, and the
 * previous record of each pair comes from all records, which the
 * implementation answers in one query rather than by loading the history.
 */
export abstract class QcExecutionReader {
  /**
   * Every record `filter` admits, oldest first: by `performedAt`, records
   * made at one instant in the order they were made. "Previous" follows the
   * same order.
   */
  abstract matching(filter: QcExecutionFilter): Promise<QcExecutionRow[]>;

  /**
   * The latest record of each activity on each of these pieces of equipment
   * that has any — activities no longer assigned included.
   */
  abstract lastPerformed(
    equipmentIds: readonly Identity[],
  ): Promise<LastQcExecution[]>;

  /** Everyone who made a QC record, once each, in no particular order. */
  abstract performers(): Promise<QcPerformer[]>;
}
