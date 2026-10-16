import { ManufacturingInstructionRecord } from './manufacturing-instruction.mapper';
import { toCreateInput } from './manufacturing-instruction.repository';

function manufacturingInstructionRecord(
  overrides: Partial<ManufacturingInstructionRecord> = {},
): ManufacturingInstructionRecord {
  return {
    id: 'standard-bom-1',
    miCode: '1234',
    brand: 'Legrand',
    standardLength: 305,
    active: true,
    description: null,
    productId: 'product-1',
    productName: 'Product 1',
    components: [
      {
        componentId: 'component-1',
        name: 'Bolt',
        materials: [
          { materialId: 'material-1', name: 'Steel Rod', weight: 150 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('toCreateInput', () => {
  it('stamps createdAt from the given instant, not the database default', () => {
    const frozenInstant = new Date('2024-06-21T08:30:00.000Z');

    const result = toCreateInput(
      manufacturingInstructionRecord(),
      frozenInstant,
    );

    expect(result.createdAt).toBe(frozenInstant);
  });

  it('carries every field of the record through unchanged', () => {
    const record = manufacturingInstructionRecord();

    const result = toCreateInput(record, new Date('2024-06-21T08:30:00.000Z'));

    expect(result.id).toBe(record.id);
    expect(result.miCode).toBe(record.miCode);
    expect(result.brand).toBe(record.brand);
    expect(result.standardLength).toBe(record.standardLength);
    expect(result.active).toBe(record.active);
    expect(result.description).toBe(record.description);
    expect(result.productId).toBe(record.productId);
    expect(result.productName).toBe(record.productName);
    expect(result.components).toEqual({
      create: [
        {
          componentId: 'component-1',
          name: 'Bolt',
          position: 0,
          materials: {
            create: [
              {
                materialId: 'material-1',
                name: 'Steel Rod',
                weight: 150,
                position: 0,
              },
            ],
          },
        },
      ],
    });
  });

  it("records each component's and each material's position from its index in the composition", () => {
    const record = manufacturingInstructionRecord({
      components: [
        {
          componentId: 'component-1',
          name: 'Core',
          materials: [
            { materialId: 'material-1', name: 'Copper', weight: 2 },
            { materialId: 'material-2', name: 'Tin', weight: 1 },
          ],
        },
        {
          componentId: 'component-2',
          name: 'Sheath',
          materials: [{ materialId: 'material-3', name: 'PVC', weight: 4 }],
        },
      ],
    });

    const result = toCreateInput(record, new Date('2024-06-21T08:30:00.000Z'));

    expect(
      result.components.create.map((component) => ({
        name: component.name,
        position: component.position,
        materials: component.materials.create.map((material) => [
          material.name,
          material.position,
        ]),
      })),
    ).toEqual([
      {
        name: 'Core',
        position: 0,
        materials: [
          ['Copper', 0],
          ['Tin', 1],
        ],
      },
      { name: 'Sheath', position: 1, materials: [['PVC', 0]] },
    ]);
  });
});
