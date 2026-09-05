import { ApplicationException } from '@framework/application';

// Thrown while registering or editing a product when a material name given
// in the request does not resolve to a `Material` master row already
// registered in the `materials` module. Deliberately a 400, like this
// module's other composition invariants: the request body's own content
// references something that doesn't exist, rather than conflicting with
// existing state. Registering or editing a product must never mint a new
// `Material` row on the spot — see `ProductCompositionFactory.resolveMaterialId`
// and src/modules/products/CLAUDE.md.
export class MaterialNotRegistered extends ApplicationException {
  private constructor(
    message: string,
    public readonly materialName: string,
  ) {
    super(message);
  }

  public static withName(name: string): MaterialNotRegistered {
    return new MaterialNotRegistered(
      `No material named "${name}" is registered`,
      name,
    );
  }
}
