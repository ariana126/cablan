import { ApplicationException } from '@framework/application';

// Thrown while registering or editing a BOM when a requested (componentId,
// materialId) pair does not exist in the referenced standard BOM's *current*
// composition — either a component id the standard BOM doesn't currently
// carry, or a material id that isn't currently one of the referenced
// component's own materials. Deliberately a 400: the request body itself
// references a state that doesn't exist, rather than conflicting with one
// that does. See `BomCompositionFactory`.
export class BomCompositionEntryNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly entryId: string,
  ) {
    super(message);
  }

  public static forComponent(id: string): BomCompositionEntryNotFound {
    return new BomCompositionEntryNotFound(
      `No component with id ${id} exists in the referenced standard BOM's current composition`,
      id,
    );
  }

  public static forMaterial(id: string): BomCompositionEntryNotFound {
    return new BomCompositionEntryNotFound(
      `No material with id ${id} exists in the referenced component's current materials`,
      id,
    );
  }
}
