/** A piece of equipment on the QC folder's shelf, with how many QC activities it has. */
export class QcEquipmentSummaryReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly retired: boolean,
    public readonly assignedActivityCount: number,
  ) {}
}
