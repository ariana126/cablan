import { Identity } from '@framework/domain';

import { StandardBomComponentLine } from './standard-bom-component-line.vo';
import { StandardBomMaterialLine } from './standard-bom-material-line.vo';
import { Weight } from './weight.vo';

function material(): StandardBomMaterialLine {
  return StandardBomMaterialLine.of(
    Identity.new(),
    'Steel Rod',
    Weight.ofGrams(150),
  );
}

describe('StandardBomComponentLine', () => {
  it('a standard BOM component line preserves the provided component id, name and materials', () => {
    const componentId = Identity.new();
    const materials = [material()];

    const sut = StandardBomComponentLine.of(componentId, 'Bolt', materials);

    expect(sut.componentId().equals(componentId)).toBe(true);
    expect(sut.name()).toBe('Bolt');
    expect(sut.materials()).toEqual(materials);
  });

  it('a standard BOM component line with no materials is rejected', () => {
    expect(() =>
      StandardBomComponentLine.of(Identity.new(), 'Bolt', []),
    ).toThrow();
  });

  it('two standard BOM component lines with the same values are equal', () => {
    const componentId = Identity.new();
    const materialId = Identity.new();
    const sut = StandardBomComponentLine.of(componentId, 'Bolt', [
      StandardBomMaterialLine.of(materialId, 'Steel Rod', Weight.ofGrams(150)),
    ]);
    const other = StandardBomComponentLine.of(componentId, 'Bolt', [
      StandardBomMaterialLine.of(materialId, 'Steel Rod', Weight.ofGrams(150)),
    ]);

    expect(sut.equals(other)).toBe(true);
  });
});
