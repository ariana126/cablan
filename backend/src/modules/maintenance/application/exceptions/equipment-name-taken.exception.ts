import { ApplicationException } from '@framework/application';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

// Registering or renaming equipment to a name another piece of equipment
// already has — retired equipment included. A 409 `equipment-name-taken`.
export class EquipmentNameTaken extends ApplicationException {
  private constructor(
    message: string,
    public readonly equipmentName: EquipmentName,
  ) {
    super(message);
  }

  public static withName(name: EquipmentName): EquipmentNameTaken {
    return new EquipmentNameTaken(
      `Equipment already exists with name ${name.asString()}`,
      name,
    );
  }
}
