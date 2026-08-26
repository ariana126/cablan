import { Identity, ValueObject } from '@framework/domain';

import { Weight } from './weight.vo';

/**
 * One material line cloned into a standard BOM's composition at the moment
 * of registration or editing — a snapshot of a `Material` master row's id
 * and name (see `StandardBomCompositionFactory`), plus the caller-supplied
 * `weight` in grams. Later changes to the referenced `Material` (a rename,
 * say) never retroactively change an already-registered standard BOM: this
 * is a real copy, not a reference.
 *
 * `name` is not re-validated here: it is always built from an
 * already-validated name read back from the product's current composition,
 * the same reasoning `ProductMaterialLine` documents for its own `name`.
 */
export class StandardBomMaterialLine extends ValueObject {
  private constructor(
    private readonly _materialId: Identity,
    private readonly _name: string,
    private readonly _weight: Weight,
  ) {
    super();
  }

  static of(
    materialId: Identity,
    name: string,
    weight: Weight,
  ): StandardBomMaterialLine {
    return new StandardBomMaterialLine(materialId, name, weight);
  }

  public materialId(): Identity {
    return this._materialId;
  }

  public name(): string {
    return this._name;
  }

  public weight(): Weight {
    return this._weight;
  }
}
