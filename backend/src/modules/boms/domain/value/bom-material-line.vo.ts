import { Identity, ValueObject } from '@framework/domain';

import { Weight } from './weight.vo';

/**
 * One material line cloned into a daily BOM's composition at the moment of
 * registration or editing — a snapshot of a standard BOM's own material
 * line's id and name (see `BomCompositionFactory`), plus the caller-supplied
 * `weight` in grams. Later changes to the referenced standard BOM (a
 * re-clone with a renamed material, say) never retroactively change an
 * already-registered daily BOM: this is a real copy, not a reference.
 *
 * `name` is not re-validated here: it is always built from an
 * already-validated name read back from the standard BOM's current
 * composition, the same reasoning `StandardBomMaterialLine` documents for its
 * own `name`.
 */
export class BomMaterialLine extends ValueObject {
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
  ): BomMaterialLine {
    return new BomMaterialLine(materialId, name, weight);
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
