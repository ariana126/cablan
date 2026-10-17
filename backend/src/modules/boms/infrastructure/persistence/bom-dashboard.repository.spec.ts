import { PrismaService } from '@framework/infrastructure';

import { PrismaBomDashboardRepository } from './bom-dashboard.repository';

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
