import { DomainException } from '@framework/domain';

// A write against equipment already retired: it takes no rename, no plan
// change and no execution, and cannot be retired again. A 409
// `equipment-retired`.
export class EquipmentIsRetired extends DomainException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
  ) {
    super(message);
  }

  public static withId(equipmentId: string): EquipmentIsRetired {
    return new EquipmentIsRetired(
      `Equipment ${equipmentId} is retired`,
      equipmentId,
    );
  }
}
