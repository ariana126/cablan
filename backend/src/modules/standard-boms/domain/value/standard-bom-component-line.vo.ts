import { Identity, ValueObject } from '@framework/domain';

import { StandardBomMaterialLine } from './standard-bom-material-line.vo';

/**
 * One component line cloned into a standard BOM's composition at the moment
 * of registration or editing — a snapshot of a `Component` master row's id
 * and name (see `StandardBomCompositionFactory`), carrying its own cloned
 * material lines. Never a live reference: see `StandardBomMaterialLine`'s
 * doc comment for why that matters.
 */
export class StandardBomComponentLine extends ValueObject {
  private constructor(
    private readonly _componentId: Identity,
    private readonly _name: string,
    private readonly _materials: StandardBomMaterialLine[],
  ) {
    super();
  }

  static of(
    componentId: Identity,
    name: string,
    materials: StandardBomMaterialLine[],
  ): StandardBomComponentLine {
    if (materials.length === 0) {
      throw new Error(
        'A standard BOM component must have at least one material',
      );
    }
    return new StandardBomComponentLine(componentId, name, materials);
  }

  public componentId(): Identity {
    return this._componentId;
  }

  public name(): string {
    return this._name;
  }

  public materials(): StandardBomMaterialLine[] {
    return this._materials;
  }
}
