import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

export class RegisterEquipmentCommand {
  constructor(public readonly name: EquipmentName) {}
}
