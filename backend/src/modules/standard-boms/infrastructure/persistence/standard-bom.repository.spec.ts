import { StandardBomRecord } from './standard-bom.mapper';
import { toCreateInput } from './standard-bom.repository';

function standardBomRecord(
  overrides: Partial<StandardBomRecord> = {},
): StandardBomRecord {
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

    const result = toCreateInput(standardBomRecord(), frozenInstant);

    expect(result.createdAt).toBe(frozenInstant);
  });

  it('carries every field of the record through unchanged', () => {
    const record = standardBomRecord();

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
          materials: {
            create: [
              { materialId: 'material-1', name: 'Steel Rod', weight: 150 },
            ],
          },
        },
      ],
    });
  });
});
