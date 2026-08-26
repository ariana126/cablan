import { Identity } from '@framework/domain';

import { StandardBomMaterialLine } from './standard-bom-material-line.vo';
import { Weight } from './weight.vo';

describe('StandardBomMaterialLine', () => {
  it('a standard BOM material line preserves the provided material id, name and weight', () => {
    const materialId = Identity.new();
    const weight = Weight.ofGrams(150);

    const sut = StandardBomMaterialLine.of(materialId, 'Steel Rod', weight);

    expect(sut.materialId().equals(materialId)).toBe(true);
    expect(sut.name()).toBe('Steel Rod');
    expect(sut.weight()).toEqual(weight);
  });

  it('two standard BOM material lines with the same values are equal', () => {
    const materialId = Identity.new();
    const sut = StandardBomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(150),
    );
    const other = StandardBomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(150),
    );

    expect(sut.equals(other)).toBe(true);
  });

  it('two standard BOM material lines with different weights are not equal', () => {
    const materialId = Identity.new();
    const sut = StandardBomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(150),
    );
    const other = StandardBomMaterialLine.of(
      materialId,
      'Steel Rod',
      Weight.ofGrams(200),
    );

    expect(sut.equals(other)).toBe(false);
  });
});
