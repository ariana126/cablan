/** A QC catalog entry and how many pieces of equipment it is assigned to, retired included. */
export interface QcActivityAssignmentCount {
  readonly id: string;
  readonly name: string;
  readonly assignedEquipmentCount: number;
}

/** A piece of equipment and how many QC activities are assigned to it. */
export interface EquipmentQcAssignmentCount {
  readonly id: string;
  readonly name: string;
  readonly retired: boolean;
  readonly assignedActivityCount: number;
}

/**
 * The QC lists' read side (issue #119): each count answered in one grouped
 * read, never by loading every `Equipment` aggregate with its PM plan.
 */
export abstract class QcAssignmentReader {
  /** The whole QC catalog, in no particular order. */
  abstract activities(): Promise<QcActivityAssignmentCount[]>;

  /** Every piece of equipment, retired included, in no particular order. */
  abstract equipment(): Promise<EquipmentQcAssignmentCount[]>;
}
