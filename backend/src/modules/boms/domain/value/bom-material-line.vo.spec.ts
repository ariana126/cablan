import { Identity } from '@framework/domain';

import { BomMaterialLine } from './bom-material-line.vo';
import { Weight } from './weight.vo';

describe('BomMaterialLine', () => {
  it('a BOM material line preserves the provided material id, name and weight', () => {
    const materialId = Identity.new();

    const sut = BomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(150),
    );

    expect(sut.materialId().equals(materialId)).toBe(true);
    expect(sut.name()).toBe('Steel Rod');
    expect(sut.weight().asGrams()).toBe(150);
  });

  it('two BOM material lines with the same values are equal', () => {
    const materialId = Identity.new();
    const sut = BomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(150),
    );
    const other = BomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(150),
    );

    expect(sut.equals(other)).toBe(true);
  });
});
