import { Identity } from '@framework/domain';

import { ManufacturingInstructionComponentLine } from './manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from './manufacturing-instruction-material-line.vo';
import { Weight } from './weight.vo';

function material(): ManufacturingInstructionMaterialLine {
  return ManufacturingInstructionMaterialLine.of(
    Identity.new(),
    'Steel Rod',
    Weight.ofGrams(150),
  );
}

describe('ManufacturingInstructionComponentLine', () => {
  it('a standard BOM component line preserves the provided component id, name and materials', () => {
    const componentId = Identity.new();
    const materials = [material()];

    const sut = ManufacturingInstructionComponentLine.of(
      componentId,
      'Bolt',
      materials,
    );

    expect(sut.componentId().equals(componentId)).toBe(true);
    expect(sut.name()).toBe('Bolt');
    expect(sut.materials()).toEqual(materials);
  });

  it('a standard BOM component line with no materials is rejected', () => {
    expect(() =>
      ManufacturingInstructionComponentLine.of(Identity.new(), 'Bolt', []),
    ).toThrow();
  });

  it('two standard BOM component lines with the same values are equal', () => {
    const componentId = Identity.new();
    const materialId = Identity.new();
    const sut = ManufacturingInstructionComponentLine.of(componentId, 'Bolt', [
      ManufacturingInstructionMaterialLine.of(
        materialId,
        'Steel Rod',
        Weight.ofGrams(150),
      ),
    ]);
    const other = ManufacturingInstructionComponentLine.of(
      componentId,
      'Bolt',
      [
        ManufacturingInstructionMaterialLine.of(
          materialId,
          'Steel Rod',
          Weight.ofGrams(150),
        ),
      ],
    );

    expect(sut.equals(other)).toBe(true);
  });
});
