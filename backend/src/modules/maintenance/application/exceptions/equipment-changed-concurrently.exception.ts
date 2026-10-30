import { ApplicationException } from '@framework/application';

// A write to equipment's plan refused because another request changed the
// same plan after this one loaded it — two plan items added at once both
// took the same place in the plan. Nothing was saved; trying again works on
// the current plan. A 409 `equipment-changed-concurrently`.
export class EquipmentChangedConcurrently extends ApplicationException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
  ) {
    super(message);
  }

  public static withId(equipmentId: string): EquipmentChangedConcurrently {
    return new EquipmentChangedConcurrently(
      `Equipment ${equipmentId} was changed by another request meanwhile`,
      equipmentId,
    );
  }
}
