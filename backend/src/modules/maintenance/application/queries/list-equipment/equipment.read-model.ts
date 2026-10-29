export class EquipmentReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly retired: boolean,
  ) {}
}
