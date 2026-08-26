import { Identity, ValueObject } from '@framework/domain';

import { ProductMaterialLine } from './product-material-line.vo';

/**
 * One component entered while registering or editing a product — always a
 * brand-new `Component` master row (see `ProductCompositionFactory`), never
 * a reference to a pre-existing one, so `componentId` and `name` are all a
 * product ever needs to remember about it. Carries its own materials, each
 * of which was likewise just created.
 *
 * `name` is not re-validated here — see `ProductMaterialLine`'s equivalent
 * note.
 */
export class ProductComponentLine extends ValueObject {
  private constructor(
    private readonly _componentId: Identity,
    private readonly _name: string,
    private readonly _materials: ProductMaterialLine[],
  ) {
    super();
  }

  static of(
    componentId: Identity,
    name: string,
    materials: ProductMaterialLine[],
  ): ProductComponentLine {
    if (materials.length === 0) {
      throw new Error('A product component must have at least one material');
    }
    return new ProductComponentLine(componentId, name, materials);
  }

  public componentId(): Identity {
    return this._componentId;
  }

  public name(): string {
    return this._name;
  }

  public materials(): ProductMaterialLine[] {
    return this._materials;
  }
}
