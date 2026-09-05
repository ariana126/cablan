import { ApplicationException } from '@framework/application';

// Thrown while registering or editing a product when a component name given
// in the request does not resolve to a `Component` master row already
// registered in the `components` module. Deliberately a 400, like this
// module's other composition invariants: the request body's own content
// references something that doesn't exist, rather than conflicting with
// existing state. Registering or editing a product must never mint a new
// `Component` row on the spot — see `ProductCompositionFactory.resolveComponentId`
// and src/modules/products/CLAUDE.md.
export class ComponentNotRegistered extends ApplicationException {
  private constructor(
    message: string,
    public readonly componentName: string,
  ) {
    super(message);
  }

  public static withName(name: string): ComponentNotRegistered {
    return new ComponentNotRegistered(
      `No component named "${name}" is registered`,
      name,
    );
  }
}
