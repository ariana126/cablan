import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

// No equipment has this id, asked through a QC route. A 404
// `equipment-not-found`, as issue #119's contract pinned it; the PM routes
// still answer an unknown equipment with the generic `entity-not-found`.
export class EquipmentNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly equipmentId: string,
  ) {
    super(message);
  }

  public static withId(id: Identity): EquipmentNotFound {
    return new EquipmentNotFound(
      `No equipment has id ${id.asString()}`,
      id.asString(),
    );
  }
}
