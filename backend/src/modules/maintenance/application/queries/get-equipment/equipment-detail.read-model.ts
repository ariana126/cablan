import { PmPlanItemReadModel } from './pm-plan-item.read-model';

export class EquipmentDetailReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly retired: boolean,
    /** Active items only, in the order they were added. */
    public readonly planItems: PmPlanItemReadModel[],
  ) {}
}
