import { ManufacturingInstructionDetail } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/manufacturing-instruction-detail.read-model';

import { StandardWeightTable } from './standard-bom-weights';

function standardBomWith(
  components: Array<{ componentId: string; weights: number[] }>,
): ManufacturingInstructionDetail {
  return new ManufacturingInstructionDetail(
    'std-1001',
    '1001',
    'Legrand',
    'Product 1',
    305,
    true,
    null,
    components.map(({ componentId, weights }) => ({
      componentId,
      name: componentId,
      materials: weights.map((weight, index) => ({
        materialId: `${componentId}-m${index}`,
        name: `material ${index}`,
        weight,
      })),
    })),
    // Deliberately not the sum: the table totals the composition itself.
    0,
  );
}

describe('StandardWeightTable', () => {
  it('totals every material weight of the standard BOM, across components', () => {
    const table = StandardWeightTable.of(
      standardBomWith([
        { componentId: 'core', weights: [0.1, 0.2] },
        { componentId: 'jacket', weights: [0.15] },
      ]),
    );

    // Exact, not `toBeCloseTo`: 0.1 + 0.2 + 0.15 must come out free of float noise.
    expect({ total: table.totalWeight() }).toEqual({ total: 0.45 });
  });

  it('totals an empty standard BOM as 0', () => {
    expect(StandardWeightTable.of(standardBomWith([])).totalWeight()).toBe(0);
  });
});
