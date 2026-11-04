import { DomainException } from '@framework/domain';

// Deleting or reactivating equipment still in service: only retired
// equipment is deleted or brought back (issue #110). A 409
// `equipment-not-retired`.
export class EquipmentNotRetired extends DomainException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
  ) {
    super(message);
  }

  public static withId(equipmentId: string): EquipmentNotRetired {
    return new EquipmentNotRetired(
      `Equipment ${equipmentId} is in service, not retired`,
      equipmentId,
    );
  }
}
