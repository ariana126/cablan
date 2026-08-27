import { Identity, ValueObject } from '@framework/domain';

import { BomMaterialLine } from './bom-material-line.vo';

/**
 * One component line cloned into a daily BOM's composition at the moment of
 * registration or editing — a snapshot of a standard BOM's own component
 * line's id and name (see `BomCompositionFactory`), carrying its own cloned
 * material lines. Never a live reference: see `BomMaterialLine`'s doc
 * comment for why that matters.
 */
export class BomComponentLine extends ValueObject {
  private constructor(
    private readonly _componentId: Identity,
    private readonly _name: string,
    private readonly _materials: BomMaterialLine[],
  ) {
    super();
  }

  static of(
    componentId: Identity,
    name: string,
    materials: BomMaterialLine[],
  ): BomComponentLine {
    if (materials.length === 0) {
      throw new Error('A BOM component must have at least one material');
    }
    return new BomComponentLine(componentId, name, materials);
  }

  public componentId(): Identity {
    return this._componentId;
  }

  public name(): string {
    return this._name;
  }

  public materials(): BomMaterialLine[] {
    return this._materials;
  }
}
