/** A piece of equipment the PM schedule can be filtered by. */
export interface PmScheduleEquipmentOption {
  readonly id: string;
  readonly name: string;
  readonly retired: boolean;
}

/** An activity, or a performer (by user id), the PM schedule can be filtered by. */
export interface PmScheduleNamedOption {
  readonly id: string;
  readonly name: string;
}

/** The choices of the PM schedule's filters, each list by Persian name. */
export class PmScheduleFilterOptionsReadModel {
  constructor(
    /** Every piece of equipment, retired included. */
    public readonly equipment: PmScheduleEquipmentOption[],
    /** The whole activity catalog. */
    public readonly activities: PmScheduleNamedOption[],
    /** Everyone who performed an execution, by the name of their latest one. */
    public readonly performers: PmScheduleNamedOption[],
  ) {}
}
