import { Identity, ValueObject } from '@framework/domain';

/**
 * One material entered while registering or editing a product's component —
 * always a brand-new `Material` master row (see
 * `ProductCompositionFactory`), never a reference to a pre-existing one, so
 * `materialId` and `name` are all a product ever needs to remember about it.
 *
 * `name` is not re-validated here: it is always built from an already
 * `MaterialName`-validated string (see `ProductCompositionFactory` and
 * `ProductMapper.toDomain`), the same reasoning that lets
 * `Component.fromPersistence` skip re-validating a stored `ComponentName`.
 */
export class ProductMaterialLine extends ValueObject {
  private constructor(
    private readonly _materialId: Identity,
    private readonly _name: string,
  ) {
    super();
  }

  static of(materialId: Identity, name: string): ProductMaterialLine {
    return new ProductMaterialLine(materialId, name);
  }

  public materialId(): Identity {
    return this._materialId;
  }

  public name(): string {
    return this._name;
  }
}
