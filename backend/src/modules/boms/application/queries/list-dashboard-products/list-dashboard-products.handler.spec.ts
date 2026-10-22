import {
  BomDashboardFilters,
  BomDashboardRepository,
  ProductDashboardSummaryRecord,
} from '@boms/application/service/bom-dashboard.repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { ListDashboardProductsHandler } from './list-dashboard-products.handler';
import { ListDashboardProductsQuery } from './list-dashboard-products.query';

// A hand-written fake, not a mock: the dashboard repository is an
// in-process collaborator from the handler's point of view, so tests
// record what it was asked and return a scripted response, rather than
// asserting call-by-call on a generic spy. Mirrors
// `InMemoryBomReportRepository`.
class InMemoryBomDashboardRepository extends BomDashboardRepository {
  public lastListFilters: BomDashboardFilters | undefined;
  private listDashboardProductsResult: ProductDashboardSummaryRecord[] = [];

  respondToListDashboardProductsWith(
    records: ProductDashboardSummaryRecord[],
  ): void {
    this.listDashboardProductsResult = records;
  }

  listDashboardProducts(
    filters: BomDashboardFilters,
  ): Promise<ProductDashboardSummaryRecord[]> {
    this.lastListFilters = filters;
    return Promise.resolve(this.listDashboardProductsResult);
  }

  listProductDailyBoms(): Promise<never[]> {
    return Promise.resolve([]);
  }
}

describe('ListDashboardProductsHandler', () => {
  it('returns every dashboard summary the repository hands back, in repository order', async () => {
    const repository = new InMemoryBomDashboardRepository();
    repository.respondToListDashboardProductsWith([
      {
        productId: 'product-1',
        productName: 'Alpha',
        dailyBomCount: 4,
        lastRegisteredAt: new Date('2026-06-22T04:00:00.000Z'),
      },
      {
        productId: 'product-2',
        productName: 'Bravo',
        dailyBomCount: 1,
        lastRegisteredAt: new Date('2026-06-21T04:00:00.000Z'),
      },
    ]);
    const sut = new ListDashboardProductsHandler(repository);

    const result = await sut.execute(new ListDashboardProductsQuery({}));

    expect(result).toEqual([
      {
        productId: 'product-1',
        productName: 'Alpha',
        dailyBomCount: 4,
        lastRegisteredAt: new Date('2026-06-22T04:00:00.000Z'),
      },
      {
        productId: 'product-2',
        productName: 'Bravo',
        dailyBomCount: 1,
        lastRegisteredAt: new Date('2026-06-21T04:00:00.000Z'),
      },
    ]);
  });

  it('passes an absent from/to pair through to the repository unchanged', async () => {
    const repository = new InMemoryBomDashboardRepository();
    const sut = new ListDashboardProductsHandler(repository);

    await sut.execute(new ListDashboardProductsQuery({}));

    expect(repository.lastListFilters).toEqual({});
  });

  it('passes the date-range and approval filters through to the repository unchanged', async () => {
    const repository = new InMemoryBomDashboardRepository();
    const sut = new ListDashboardProductsHandler(repository);
    const filters: BomDashboardFilters = {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-30T23:59:59.000Z'),
      approvalStatuses: [ApprovalStatus.Approved],
      approvers: ['مصطفی', ''],
    };

    await sut.execute(new ListDashboardProductsQuery(filters));

    expect(repository.lastListFilters).toEqual(filters);
  });

  it('keeps an empty approval filter as an empty list, not as absent', async () => {
    const repository = new InMemoryBomDashboardRepository();
    const sut = new ListDashboardProductsHandler(repository);

    await sut.execute(
      new ListDashboardProductsQuery({ approvalStatuses: [], approvers: [] }),
    );

    expect(repository.lastListFilters).toEqual({
      approvalStatuses: [],
      approvers: [],
    });
  });

  it('returns an empty list when the repository reports no products with daily BOMs in the range', async () => {
    const repository = new InMemoryBomDashboardRepository();
    const sut = new ListDashboardProductsHandler(repository);

    const result = await sut.execute(new ListDashboardProductsQuery({}));

    expect(result).toEqual([]);
  });
});
