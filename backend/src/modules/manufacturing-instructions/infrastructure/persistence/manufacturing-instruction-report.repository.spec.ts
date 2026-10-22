import {
  toExportRecord,
  toWhereInput,
} from './manufacturing-instruction-report.repository';

// `toExportRecord`'s input is the row shape `prisma.manufacturingInstruction.findMany`
// returns once `components`/`materials` are included — built by hand here
// rather than through Prisma, mirroring `bom-report.repository.spec.ts`'s
// `bomWithComposition()`, since this transformation is the only part of
// `exportRecords()` that is unit-testable without a real database (see
// src/modules/manufacturing-instructions/CLAUDE.md and `handbook:test-guideline`'s
// "Database Testing").
function manufacturingInstructionWithComposition(
  overrides: Partial<Parameters<typeof toExportRecord>[0]> = {},
): Parameters<typeof toExportRecord>[0] {
  return {
    id: 'standard-bom-1',
    miCode: '1001',
    brand: 'Legrand',
    standardLength: 305,
    active: true,
    description: 'Quality check',
    productId: 'product-1',
    productName: 'Product 1',
    createdAt: new Date('2026-06-22T04:00:00.000Z'),
    updatedAt: new Date('2026-06-22T04:00:00.000Z'),
    components: [
      {
        id: 'standard-bom-component-1',
        manufacturingInstructionId: 'standard-bom-1',
        componentId: 'component-1',
        name: 'Bolt',
        position: 0,
        materials: [
          {
            id: 'standard-bom-material-1',
            manufacturingInstructionComponentId: 'standard-bom-component-1',
            materialId: 'material-1',
            name: 'Steel Rod',
            weight: 150,
            position: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('toExportRecord', () => {
  it('maps every own field, dropping id/productId', () => {
    const result = toExportRecord(manufacturingInstructionWithComposition());

    expect(result).toEqual({
      miCode: '1001',
      brand: 'Legrand',
      standardLength: 305,
      active: true,
      productName: 'Product 1',
      description: 'Quality check',
      components: [
        {
          name: 'Bolt',
          materials: [{ name: 'Steel Rod', weight: 150 }],
        },
      ],
    });
  });

  it('carries a null description through unchanged', () => {
    const result = toExportRecord(
      manufacturingInstructionWithComposition({ description: null }),
    );

    expect(result.description).toBeNull();
  });

  it('carries active: false through unchanged', () => {
    const result = toExportRecord(
      manufacturingInstructionWithComposition({ active: false }),
    );

    expect(result.active).toBe(false);
  });

  it('drops component and material ids, keeping only their names', () => {
    const result = toExportRecord(manufacturingInstructionWithComposition());

    expect(result.components[0]).not.toHaveProperty('id');
    expect(result.components[0].materials[0]).not.toHaveProperty('id');
  });
});

describe('toWhereInput MI code filter', () => {
  it('leaves the MI code unfiltered when the filter is absent', () => {
    expect(toWhereInput({})).toEqual({});
  });

  it('matches the selected MI codes', () => {
    expect(toWhereInput({ miCodes: ['1001', '1004'] })).toEqual({
      miCode: { in: ['1001', '1004'] },
    });
  });

  it('matches nothing for an empty MI code list', () => {
    expect(toWhereInput({ miCodes: [] })).toEqual({ miCode: { in: [] } });
  });

  it('combines the MI code filter with the other filters', () => {
    expect(toWhereInput({ miCodes: ['1001'], brands: ['لگراند'] })).toEqual({
      brand: { in: ['لگراند'] },
      miCode: { in: ['1001'] },
    });
  });
});
