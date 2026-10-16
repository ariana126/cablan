import { Identity, ValueObject } from '@framework/domain';

import { ManufacturingInstructionMaterialLine } from './manufacturing-instruction-material-line.vo';

/**
 * One component line cloned into a standard BOM's composition at the moment
 * of registration or editing — a snapshot of a `Component` master row's id
 * and name (see `ManufacturingInstructionCompositionFactory`), carrying its own cloned
 * material lines. Never a live reference: see `ManufacturingInstructionMaterialLine`'s
 * doc comment for why that matters.
 */
export class ManufacturingInstructionComponentLine extends ValueObject {
  private constructor(
    private readonly _componentId: Identity,
    private readonly _name: string,
    private readonly _materials: ManufacturingInstructionMaterialLine[],
  ) {
    super();
  }

  static of(
    componentId: Identity,
    name: string,
    materials: ManufacturingInstructionMaterialLine[],
  ): ManufacturingInstructionComponentLine {
    if (materials.length === 0) {
      throw new Error(
        'A standard BOM component must have at least one material',
      );
    }
    return new ManufacturingInstructionComponentLine(
      componentId,
      name,
      materials,
    );
  }

  public componentId(): Identity {
    return this._componentId;
  }

  public name(): string {
    return this._name;
  }

  public materials(): ManufacturingInstructionMaterialLine[] {
    return this._materials;
  }
}
