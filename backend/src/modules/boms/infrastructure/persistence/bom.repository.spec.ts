import { BomRecord } from './bom.mapper';
import { toCreateInput } from './bom.repository';

function bomRecord(overrides: Partial<BomRecord> = {}): BomRecord {
  return {
    id: 'bom-1',
    standardBomId: 'standard-bom-1',
    standardBomMiCode: '1234',
    brand: 'Legrand',
    productName: 'Product 1',
    standardLength: 305,
    orderNumber: 'SO-1234',
    trackingNumber: 'TN-5678',
    description: null,
    registeredBy: 'Sina',
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

    const result = toCreateInput(bomRecord(), frozenInstant);

    expect(result.createdAt).toBe(frozenInstant);
  });

  it('carries every field of the record through unchanged', () => {
    const record = bomRecord();

    const result = toCreateInput(record, new Date('2024-06-21T08:30:00.000Z'));

    expect(result.id).toBe(record.id);
    expect(result.standardBomId).toBe(record.standardBomId);
    expect(result.standardBomMiCode).toBe(record.standardBomMiCode);
    expect(result.brand).toBe(record.brand);
    expect(result.productName).toBe(record.productName);
    expect(result.standardLength).toBe(record.standardLength);
    expect(result.orderNumber).toBe(record.orderNumber);
    expect(result.trackingNumber).toBe(record.trackingNumber);
    expect(result.description).toBe(record.description);
    expect(result.registeredBy).toBe(record.registeredBy);
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
    const record = bomRecord({
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
