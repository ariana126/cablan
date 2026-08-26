import { ApplicationException } from '@framework/application';

// Thrown while editing a product when a composition entry's `id` does not
// belong to *this* product's current composition — either a component id
// the product doesn't currently carry, or a material id that isn't currently
// one of the referenced component's own materials. Deliberately a 400, like
// this module's other composition invariants: the request body itself
// references a state that doesn't exist, rather than conflicting with one
// that does. See `ProductCompositionFactory.reconcileComponentLines` and
// src/modules/products/CLAUDE.md.
export class ProductCompositionEntryNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly entryId: string,
  ) {
    super(message);
  }

  public static forComponent(id: string): ProductCompositionEntryNotFound {
    return new ProductCompositionEntryNotFound(
      `No component with id ${id} exists in this product's current composition`,
      id,
    );
  }

  public static forMaterial(id: string): ProductCompositionEntryNotFound {
    return new ProductCompositionEntryNotFound(
      `No material with id ${id} exists in this product's current composition`,
      id,
    );
  }
}
