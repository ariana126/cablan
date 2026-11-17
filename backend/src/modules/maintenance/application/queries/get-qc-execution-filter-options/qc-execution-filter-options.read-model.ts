/** An activity or a recorder the QC records can be filtered by. */
export interface QcNamedOption {
  readonly id: string;
  readonly name: string;
}

/** A piece of equipment the QC records can be filtered by. */
export interface QcEquipmentOption extends QcNamedOption {
  readonly retired: boolean;
}

/** The choices of the QC records' filters, each list by Persian name. */
export interface QcExecutionFilterOptionsReadModel {
  /** Every piece of equipment, retired included. */
  readonly equipment: QcEquipmentOption[];
  /** The whole QC catalog. */
  readonly activities: QcNamedOption[];
  /** Everyone who made a QC record, by the name of their latest one. */
  readonly performers: QcNamedOption[];
}
