import { ApplicationException } from '@framework/application';

// Thrown while registering or editing a standard BOM when a requested
// (componentId, materialId) pair does not exist in the referenced product's
// *current* composition — either a component id the product doesn't
// currently carry, or a material id that isn't currently one of the
// referenced component's own materials. Deliberately a 400: the request
// body itself references a state that doesn't exist, rather than
// conflicting with one that does. See `StandardBomCompositionFactory`.
export class StandardBomCompositionEntryNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly entryId: string,
  ) {
    super(message);
  }

  public static forComponent(id: string): StandardBomCompositionEntryNotFound {
    return new StandardBomCompositionEntryNotFound(
      `No component with id ${id} exists in the referenced product's current composition`,
      id,
    );
  }

  public static forMaterial(id: string): StandardBomCompositionEntryNotFound {
    return new StandardBomCompositionEntryNotFound(
      `No material with id ${id} exists in the referenced component's current materials`,
      id,
    );
  }
}
