import { Identity } from '@framework/domain';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

export class RenameEquipmentCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly name: EquipmentName,
  ) {}
}
