import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';

import { PrismaBomDashboardRepository } from './bom-dashboard.repository';
import { toWhereInput } from './bom-report.repository';

// `listDashboardProducts` groups daily BOMs by (productName, standardBomId) and then folds the
// groups of one product together. The fold is the only logic here, so Prisma is faked at the two
// calls it makes rather than reached through a database.
function repositoryOver(
  groups: {
    productName: string;
    standardBomId: string;
    count: number;
    newest: Date;
  }[],
  standardBoms: { id: string; productId: string; productName: string }[],
) {
  const prisma = {
    bom: {
      groupBy: jest.fn().mockResolvedValue(
        groups.map((group) => ({
          productName: group.productName,
          standardBomId: group.standardBomId,
          _count: { _all: group.count },
          _max: { createdAt: group.newest },
        })),
      ),
    },
    manufacturingInstruction: {
      findMany: jest.fn().mockResolvedValue(standardBoms),
    },
  };
  return new PrismaBomDashboardRepository(prisma as unknown as PrismaService);
}

describe('PrismaBomDashboardRepository.listDashboardProducts', () => {
  it('sums the counts of a product’s standard BOMs and keeps the newest registration', async () => {
    const sut = repositoryOver(
      [
        {
          productName: 'Alpha',
          standardBomId: 'sb-1',
          count: 2,
          newest: new Date('2026-06-21T04:00:00.000Z'),
        },
        {
          productName: 'Alpha',
          standardBomId: 'sb-2',
          count: 3,
          newest: new Date('2026-06-23T04:00:00.000Z'),
        },
        {
          productName: 'Alpha',
          standardBomId: 'sb-3',
          count: 1,
          newest: new Date('2026-06-22T04:00:00.000Z'),
        },
      ],
      [
        { id: 'sb-1', productId: 'p1', productName: 'Alpha' },
        { id: 'sb-2', productId: 'p1', productName: 'Alpha' },
        { id: 'sb-3', productId: 'p1', productName: 'Alpha' },
      ],
    );

    const result = await sut.listDashboardProducts({});

    expect(result).toEqual([
      {
        productId: 'p1',
        productName: 'Alpha',
        dailyBomCount: 6,
        lastRegisteredAt: new Date('2026-06-23T04:00:00.000Z'),
      },
    ]);
  });

  it('lists products by name and gives each its own newest registration', async () => {
    const sut = repositoryOver(
      [
        {
          productName: 'Bravo',
          standardBomId: 'sb-2',
          count: 1,
          newest: new Date('2026-06-20T04:00:00.000Z'),
        },
        {
          productName: 'Alpha',
          standardBomId: 'sb-1',
          count: 4,
          newest: new Date('2026-06-22T04:00:00.000Z'),
        },
      ],
      [
        { id: 'sb-1', productId: 'p1', productName: 'Alpha' },
        { id: 'sb-2', productId: 'p2', productName: 'Bravo' },
      ],
    );

    const result = await sut.listDashboardProducts({});

    expect(
      result.map((row) => [
        row.productName,
        row.lastRegisteredAt.toISOString(),
      ]),
    ).toEqual([
      ['Alpha', '2026-06-22T04:00:00.000Z'],
      ['Bravo', '2026-06-20T04:00:00.000Z'],
    ]);
  });
});

function dashboardRepositoryReturning(bomRow: Record<string, unknown>) {
  const prisma = {
    bom: { findMany: jest.fn().mockResolvedValue([bomRow]) },
    manufacturingInstruction: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'sb-1', productName: 'Alpha' }]),
    },
  };
  return new PrismaBomDashboardRepository(prisma as unknown as PrismaService);
}

function dailyBomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bom-1',
    orderNumber: 'ORD-1',
    trackingNumber: 'TRK-1',
    createdAt: new Date('2026-06-22T04:00:00.000Z'),
    registeredBy: 'نیکروش',
    description: null,
    standardBomMiCode: '1001',
    approvalStatus: 'pending',
    reviewedBy: null,
    managementNote: null,
    components: [],
    ...overrides,
  };
}

describe('PrismaBomDashboardRepository.listProductDailyBoms', () => {
  it('carries the QC operator who registered each daily BOM', async () => {
    const sut = dashboardRepositoryReturning(dailyBomRow());

    const [record] = await sut.listProductDailyBoms(Identity.new(), {});

    expect(record.registeredBy).toBe('نیکروش');
  });

  it('carries each daily BOM’s approval status, reviewer and management note', async () => {
    const sut = dashboardRepositoryReturning(
      dailyBomRow({
        approvalStatus: 'approved',
        reviewedBy: 'مصطفی',
        managementNote: 'وزن مس اصلاح شد',
      }),
    );

    const [record] = await sut.listProductDailyBoms(Identity.new(), {});

    expect(record.approvalStatus).toBe('approved');
    expect(record.reviewedBy).toBe('مصطفی');
    expect(record.managementNote).toBe('وزن مس اصلاح شد');
  });
});

// The approval filters reuse the report's `toWhereInput`, so their full truth table is pinned there
// (and against Postgres in `bom-approval.int-spec.ts`); these cases pin that both dashboard reads
// hand that same translation to their query — counts and newest registrations included, since
// `groupBy` aggregates only over the rows its `where` lets through.
// A Prisma query fake that answers nothing and records the `where` it was given.
function whereRecordingQuery() {
  return jest
    .fn<Promise<never[]>, [{ where: unknown }]>()
    .mockResolvedValue([]);
}

describe('PrismaBomDashboardRepository approval filters', () => {
  const from = new Date('2026-06-21T00:00:00.000Z');
  const to = new Date('2026-06-26T00:00:00.000Z');

  it('counts only the daily BOMs matching the approval filters, alongside the date range', async () => {
    const groupBy = whereRecordingQuery();
    const prisma = { bom: { groupBy } };
    const sut = new PrismaBomDashboardRepository(
      prisma as unknown as PrismaService,
    );

    await sut.listDashboardProducts({
      from,
      to,
      approvalStatuses: [ApprovalStatus.Approved],
      reviewers: ['مصطفی', ''],
    });

    expect(groupBy.mock.calls[0][0].where).toEqual(
      toWhereInput({
        registeredAtFrom: from,
        registeredAtTo: to,
        approvalStatuses: [ApprovalStatus.Approved],
        reviewers: ['مصطفی', ''],
      }),
    );
  });

  it('lists only the product’s daily BOMs matching the approval filters', async () => {
    const findMany = whereRecordingQuery();
    const prisma = {
      bom: { findMany },
      manufacturingInstruction: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'sb-1', productName: 'Alpha' }]),
      },
    };
    const sut = new PrismaBomDashboardRepository(
      prisma as unknown as PrismaService,
    );

    await sut.listProductDailyBoms(Identity.new(), {
      approvalStatuses: [],
      reviewers: [''],
    });

    expect(findMany.mock.calls[0][0].where).toEqual({
      standardBomId: { in: ['sb-1'] },
      ...toWhereInput({ approvalStatuses: [], reviewers: [''] }),
    });
  });

  it('leaves an absent filter unfiltered', async () => {
    const groupBy = whereRecordingQuery();
    const prisma = { bom: { groupBy } };
    const sut = new PrismaBomDashboardRepository(
      prisma as unknown as PrismaService,
    );

    await sut.listDashboardProducts({});

    expect(groupBy.mock.calls[0][0].where).toEqual({});
  });
});
