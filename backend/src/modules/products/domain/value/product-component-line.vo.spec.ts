import { Identity } from '@framework/domain';

import { ProductComponentLine } from './product-component-line.vo';
import { ProductMaterialLine } from './product-material-line.vo';

function material(): ProductMaterialLine {
  return ProductMaterialLine.of(Identity.new(), 'Steel Rod');
}

describe('ProductComponentLine', () => {
  it('a product component line preserves the provided component id, name and materials', () => {
    const componentId = Identity.new();
    const materials = [material()];

    const sut = ProductComponentLine.of(componentId, 'Bolt', materials);

    expect(sut.componentId().equals(componentId)).toBe(true);
    expect(sut.name()).toBe('Bolt');
    expect(sut.materials()).toEqual(materials);
  });

  it('a product component line with no materials is rejected', () => {
    expect(() => ProductComponentLine.of(Identity.new(), 'Bolt', [])).toThrow();
  });

  it('two product component lines with the same values are equal', () => {
    const componentId = Identity.new();
    const materialId = Identity.new();
    const sut = ProductComponentLine.of(componentId, 'Bolt', [
      ProductMaterialLine.of(materialId, 'Steel Rod'),
    ]);
    const other = ProductComponentLine.of(componentId, 'Bolt', [
      ProductMaterialLine.of(materialId, 'Steel Rod'),
    ]);

    expect(sut.equals(other)).toBe(true);
  });
});
