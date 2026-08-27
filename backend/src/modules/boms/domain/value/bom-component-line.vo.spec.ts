import { Identity } from '@framework/domain';

import { BomComponentLine } from './bom-component-line.vo';
import { BomMaterialLine } from './bom-material-line.vo';
import { Weight } from './weight.vo';

function material(): BomMaterialLine {
  return BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150));
}

describe('BomComponentLine', () => {
  it('a BOM component line preserves the provided component id, name and materials', () => {
    const componentId = Identity.new();
    const materials = [material()];

    const sut = BomComponentLine.of(componentId, 'Bolt', materials);

    expect(sut.componentId().equals(componentId)).toBe(true);
    expect(sut.name()).toBe('Bolt');
    expect(sut.materials()).toEqual(materials);
  });

  it('a BOM component line with no materials is rejected', () => {
    expect(() => BomComponentLine.of(Identity.new(), 'Bolt', [])).toThrow();
  });

  it('two BOM component lines with the same values are equal', () => {
    const componentId = Identity.new();
    const materialId = Identity.new();
    const sut = BomComponentLine.of(componentId, 'Bolt', [
      BomMaterialLine.of(materialId, 'Steel Rod', Weight.ofGrams(150)),
    ]);
    const other = BomComponentLine.of(componentId, 'Bolt', [
      BomMaterialLine.of(materialId, 'Steel Rod', Weight.ofGrams(150)),
    ]);

    expect(sut.equals(other)).toBe(true);
  });
});
