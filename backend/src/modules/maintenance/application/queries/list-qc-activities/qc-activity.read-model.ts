/** A QC catalog entry, with how many pieces of equipment it is assigned to (retired included). */
export class QcActivityReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly assignedEquipmentCount: number,
  ) {}
}
