import { DomainException } from '@framework/domain';

// A write against equipment already retired: it takes no rename, no plan
// change, no execution, no QC assignment or unassignment and no QC record,
// and cannot be retired again. A 409 `equipment-retired`. The equipment's
// name is there for a detail naming it («"اکسترودر 1" کنار گذاشته شده
// است.», issue #119); `null` only where the thrower did not give it.
export class EquipmentIsRetired extends DomainException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
    public readonly equipmentName: string | null,
  ) {
    super(message);
  }

  public static withId(equipmentId: string): EquipmentIsRetired {
    return new EquipmentIsRetired(
      `Equipment ${equipmentId} is retired`,
      equipmentId,
      null,
    );
  }

  public static named(
    equipmentId: string,
    equipmentName: string,
  ): EquipmentIsRetired {
    return new EquipmentIsRetired(
      `Equipment ${equipmentId} is retired`,
      equipmentId,
      equipmentName,
    );
  }
}
