import { Identity } from '@framework/domain';

import { ProductMaterialLine } from './product-material-line.vo';

describe('ProductMaterialLine', () => {
  it('a product material line preserves the provided material id and name', () => {
    const materialId = Identity.new();

    const sut = ProductMaterialLine.of(materialId, 'Steel Rod');

    expect(sut.materialId().equals(materialId)).toBe(true);
    expect(sut.name()).toBe('Steel Rod');
  });

  it('two product material lines with the same values are equal', () => {
    const materialId = Identity.new();
    const sut = ProductMaterialLine.of(materialId, 'Steel Rod');
    const other = ProductMaterialLine.of(materialId, 'Steel Rod');

    expect(sut.equals(other)).toBe(true);
  });

  it('two product material lines with different ids are not equal', () => {
    const sut = ProductMaterialLine.of(Identity.new(), 'Steel Rod');
    const other = ProductMaterialLine.of(Identity.new(), 'Steel Rod');

    expect(sut.equals(other)).toBe(false);
  });
});
