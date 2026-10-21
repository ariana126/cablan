import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { toExportRecord, toWhereInput } from './bom-report.repository';

// `toExportRecord`'s input is the row shape `prisma.bom.findMany` returns
// once `components`/`materials` are included — built by hand here rather
// than through Prisma, mirroring `bom.repository.spec.ts`'s `bomRecord()`,
// since this transformation is the only part of `exportRecords()` that is
// unit-testable without a real database (see src/modules/boms/CLAUDE.md and
// `handbook:test-guideline`'s "Database Testing").
function bomWithComposition(
  overrides: Partial<Parameters<typeof toExportRecord>[0]> = {},
): Parameters<typeof toExportRecord>[0] {
  return {
    id: 'bom-1',
    standardBomId: 'standard-bom-1',
    standardBomMiCode: '1001',
    brand: 'Legrand',
    productName: 'Product 1',
    standardLength: 305,
    orderNumber: 'ORD-2001',
    trackingNumber: 'TRK-3001',
    description: 'Quality check',
    registeredBy: 'Sina',
    approvalStatus: 'approved',
    approvedBy: 'مصطفی',
    createdAt: new Date('2026-06-22T04:00:00.000Z'),
    updatedAt: new Date('2026-06-22T04:00:00.000Z'),
    components: [
      {
        id: 'bom-component-1',
        bomId: 'bom-1',
        componentId: 'component-1',
        name: 'Bolt',
        position: 0,
        materials: [
          {
            id: 'bom-material-1',
            bomComponentId: 'bom-component-1',
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
  it('maps every field but id/standardBomId, and formats registeredAt as createdAt', () => {
    const result = toExportRecord(bomWithComposition());

    expect(result).toEqual({
      orderNumber: 'ORD-2001',
      trackingNumber: 'TRK-3001',
      registeredAt: new Date('2026-06-22T04:00:00.000Z'),
      registeredBy: 'Sina',
      standardBomMiCode: '1001',
      brand: 'Legrand',
      standardLength: 305,
      productName: 'Product 1',
      description: 'Quality check',
      approvalStatus: 'approved',
      approvedBy: 'مصطفی',
      components: [
        {
          name: 'Bolt',
          materials: [{ name: 'Steel Rod', weight: 150 }],
        },
      ],
    });
  });

  it('carries a null description through unchanged', () => {
    const result = toExportRecord(bomWithComposition({ description: null }));

    expect(result.description).toBeNull();
  });

  it('drops component and material ids, keeping only their names', () => {
    const result = toExportRecord(bomWithComposition());

    expect(result.components[0]).not.toHaveProperty('id');
    expect(result.components[0].materials[0]).not.toHaveProperty('id');
  });
});

describe('toWhereInput approver filter', () => {
  it('leaves the approver unfiltered when the filter is absent', () => {
    expect(toWhereInput({})).toEqual({});
  });

  it('matches nothing for an empty approver list', () => {
    expect(toWhereInput({ approvers: [] })).toEqual({
      AND: [{ approvedBy: { in: [] } }],
    });
  });

  it('matches the named approvers', () => {
    expect(toWhereInput({ approvers: ['مصطفی'] })).toEqual({
      AND: [{ approvedBy: { in: ['مصطفی'] } }],
    });
  });

  it("reads '' as a BOM with no approver", () => {
    expect(toWhereInput({ approvers: [''] })).toEqual({
      AND: [{ approvedBy: null }],
    });
  });

  it("matches the named approvers or no approver when '' is among them", () => {
    expect(toWhereInput({ approvers: ['مصطفی', ''] })).toEqual({
      AND: [{ OR: [{ approvedBy: { in: ['مصطفی'] } }, { approvedBy: null }] }],
    });
  });

  it('keeps every filter as its own condition, so one cannot overwrite another', () => {
    expect(
      toWhereInput({
        brands: ['لگراند'],
        approvalStatuses: [ApprovalStatus.Approved],
        approvers: ['مصطفی', ''],
      }),
    ).toEqual({
      AND: [
        { brand: { in: ['لگراند'] } },
        { approvalStatus: { in: ['approved'] } },
        { OR: [{ approvedBy: { in: ['مصطفی'] } }, { approvedBy: null }] },
      ],
    });
  });
});
