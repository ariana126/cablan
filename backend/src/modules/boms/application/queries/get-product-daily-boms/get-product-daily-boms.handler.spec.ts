import {
  BomDashboardRepository,
  ProductDailyBomRecord,
} from '@boms/application/service/bom-dashboard.repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetStandardBomDetailQuery } from '@standard-boms/application/queries/get-standard-bom-detail/get-standard-bom-detail.query';
import { StandardBomDetail } from '@standard-boms/application/queries/get-standard-bom-detail/standard-bom-detail.read-model';

import { GetProductDailyBomsHandler } from './get-product-daily-boms.handler';
import { GetProductDailyBomsQuery } from './get-product-daily-boms.query';

class InMemoryBomDashboardRepository extends BomDashboardRepository {
  public lastProductId: Identity | undefined;
  public lastFilters: { from?: Date; to?: Date } | undefined;
  private recordsByProduct: Map<string, ProductDailyBomRecord[]> = new Map();

  respondToProductDailyBoms(
    productId: Identity,
    records: ProductDailyBomRecord[],
  ): void {
    this.recordsByProduct.set(productId.asString(), records);
  }

  listDashboardProducts(): Promise<never[]> {
    return Promise.resolve([]);
  }

  listProductDailyBoms(
    productId: Identity,
    filters: { from?: Date; to?: Date },
  ): Promise<ProductDailyBomRecord[]> {
    this.lastProductId = productId;
    this.lastFilters = filters;
    return Promise.resolve(
      this.recordsByProduct.get(productId.asString()) ?? [],
    );
  }
}

function standardBomDetailFor(
  standardBomMiCode: string,
  rows: Array<{
    componentId: string;
    componentName: string;
    materialId: string;
    materialName: string;
    weight: number;
  }>,
): StandardBomDetail {
  return new StandardBomDetail(
    `std-${standardBomMiCode}`,
    standardBomMiCode,
    'Legrand',
    'Product 1',
    305,
    true,
    null,
    rows.map((row) => ({
      componentId: row.componentId,
      name: row.componentName,
      materials: [
        {
          materialId: row.materialId,
          name: row.materialName,
          weight: row.weight,
        },
      ],
    })),
    rows.reduce((sum, row) => sum + row.weight, 0),
  );
}

describe('GetProductDailyBomsHandler', () => {
  it("looks up the standard BOM's composition for each daily BOM, joining the standard weight by componentId+materialId and computing the score", async () => {
    const productId = Identity.new();
    const dashboardRepository = new InMemoryBomDashboardRepository();
    dashboardRepository.respondToProductDailyBoms(productId, [
      {
        id: 'bom-1',
        orderNumber: 'ORD-2001',
        trackingNumber: 'TRK-3001',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        description: 'Initial quality check',
        standardBomMiCode: '1001',
        materials: [
          {
            componentId: 'component-1',
            componentName: 'Core',
            materialId: 'material-1',
            materialName: 'Copper',
            actualWeight: 12,
          },
          {
            componentId: 'component-1',
            componentName: 'Core',
            materialId: 'material-2',
            materialName: 'Aluminum',
            actualWeight: 6,
          },
        ],
      },
    ]);
    const queryBus = new StubQueryBus();
    queryBus.respondTo(
      GetStandardBomDetailQuery.name,
      standardBomDetailFor('1001', [
        {
          componentId: 'component-1',
          componentName: 'Core',
          materialId: 'material-1',
          materialName: 'Copper',
          weight: 10,
        },
        {
          componentId: 'component-1',
          componentName: 'Core',
          materialId: 'material-2',
          materialName: 'Aluminum',
          weight: 5,
        },
      ]),
    );
    const sut = new GetProductDailyBomsHandler(
      dashboardRepository,
      queryBus as unknown as QueryBus,
    );

    const result = await sut.execute(new GetProductDailyBomsQuery(productId));

    expect(result).toEqual([
      {
        id: 'bom-1',
        orderNumber: 'ORD-2001',
        registeredAt: '2026-06-22T04:00:00.000Z',
        description: 'Initial quality check',
        score: 3,
        lines: [
          {
            componentName: 'Core',
            materialName: 'Copper',
            actualWeight: 12,
            standardWeight: 10,
          },
          {
            componentName: 'Core',
            materialName: 'Aluminum',
            actualWeight: 6,
            standardWeight: 5,
          },
        ],
      },
    ]);
  });

  it('sorts the result by score descending', async () => {
    const productId = Identity.new();
    const dashboardRepository = new InMemoryBomDashboardRepository();
    dashboardRepository.respondToProductDailyBoms(productId, [
      {
        id: 'bom-low',
        orderNumber: 'ORD-1',
        trackingNumber: 'TRK-1',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        description: null,
        standardBomMiCode: '1001',
        materials: [
          {
            componentId: 'c1',
            componentName: 'Core',
            materialId: 'm1',
            materialName: 'Copper',
            actualWeight: 10,
          },
        ],
      },
      {
        id: 'bom-high',
        orderNumber: 'ORD-2',
        trackingNumber: 'TRK-2',
        registeredAt: new Date('2026-06-23T04:00:00.000Z'),
        description: null,
        standardBomMiCode: '1001',
        materials: [
          {
            componentId: 'c1',
            componentName: 'Core',
            materialId: 'm1',
            materialName: 'Copper',
            actualWeight: 25,
          },
        ],
      },
      {
        id: 'bom-mid',
        orderNumber: 'ORD-3',
        trackingNumber: 'TRK-3',
        registeredAt: new Date('2026-06-24T04:00:00.000Z'),
        description: null,
        standardBomMiCode: '1001',
        materials: [
          {
            componentId: 'c1',
            componentName: 'Core',
            materialId: 'm1',
            materialName: 'Copper',
            actualWeight: 14,
          },
        ],
      },
    ]);
    const queryBus = new StubQueryBus();
    queryBus.respondTo(
      GetStandardBomDetailQuery.name,
      standardBomDetailFor('1001', [
        {
          componentId: 'c1',
          componentName: 'Core',
          materialId: 'm1',
          materialName: 'Copper',
          weight: 10,
        },
      ]),
    );
    const sut = new GetProductDailyBomsHandler(
      dashboardRepository,
      queryBus as unknown as QueryBus,
    );

    const result = await sut.execute(new GetProductDailyBomsQuery(productId));

    expect(result.map((bom) => bom.id)).toEqual([
      'bom-high',
      'bom-mid',
      'bom-low',
    ]);
  });

  it('passes the from/to filter through to the dashboard repository unchanged', async () => {
    const productId = Identity.new();
    const dashboardRepository = new InMemoryBomDashboardRepository();
    const queryBus = new StubQueryBus();
    const sut = new GetProductDailyBomsHandler(
      dashboardRepository,
      queryBus as unknown as QueryBus,
    );
    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-30T23:59:59.000Z');

    await sut.execute(new GetProductDailyBomsQuery(productId, from, to));

    expect(dashboardRepository.lastProductId?.equals(productId)).toBe(true);
    expect(dashboardRepository.lastFilters).toEqual({ from, to });
  });

  it("uses standardWeight 0 when the daily BOM has a material that no longer exists on the standard BOM's current composition", async () => {
    const productId = Identity.new();
    const dashboardRepository = new InMemoryBomDashboardRepository();
    dashboardRepository.respondToProductDailyBoms(productId, [
      {
        id: 'bom-1',
        orderNumber: 'ORD-2001',
        trackingNumber: 'TRK-3001',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        description: null,
        standardBomMiCode: '1001',
        materials: [
          {
            componentId: 'c1',
            componentName: 'Core',
            materialId: 'm-ghost',
            materialName: 'Ghost',
            actualWeight: 7,
          },
        ],
      },
    ]);
    const queryBus = new StubQueryBus();
    queryBus.respondTo(
      GetStandardBomDetailQuery.name,
      standardBomDetailFor('1001', [
        {
          componentId: 'c1',
          componentName: 'Core',
          materialId: 'm-copper',
          materialName: 'Copper',
          weight: 10,
        },
      ]),
    );
    const sut = new GetProductDailyBomsHandler(
      dashboardRepository,
      queryBus as unknown as QueryBus,
    );

    const result = await sut.execute(new GetProductDailyBomsQuery(productId));

    expect(result).toEqual([
      {
        id: 'bom-1',
        orderNumber: 'ORD-2001',
        registeredAt: '2026-06-22T04:00:00.000Z',
        description: undefined,
        score: 7,
        lines: [
          {
            componentName: 'Core',
            materialName: 'Ghost',
            actualWeight: 7,
            standardWeight: 0,
          },
        ],
      },
    ]);
  });

  it('returns an empty list when the product has no daily BOMs in the range', async () => {
    const productId = Identity.new();
    const dashboardRepository = new InMemoryBomDashboardRepository();
    const queryBus = new StubQueryBus();
    const sut = new GetProductDailyBomsHandler(
      dashboardRepository,
      queryBus as unknown as QueryBus,
    );

    const result = await sut.execute(new GetProductDailyBomsQuery(productId));

    expect(result).toEqual([]);
    expect(queryBus.executedQueries).toEqual([]);
  });

  it('dispatches one GetStandardBomDetailQuery per daily BOM, keyed by the cloned standardBomMiCode', async () => {
    const productId = Identity.new();
    const dashboardRepository = new InMemoryBomDashboardRepository();
    dashboardRepository.respondToProductDailyBoms(productId, [
      {
        id: 'bom-1',
        orderNumber: 'ORD-2001',
        trackingNumber: 'TRK-3001',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        description: null,
        standardBomMiCode: '1001',
        materials: [],
      },
      {
        id: 'bom-2',
        orderNumber: 'ORD-2002',
        trackingNumber: 'TRK-3002',
        registeredAt: new Date('2026-06-23T04:00:00.000Z'),
        description: null,
        standardBomMiCode: '1002',
        materials: [],
      },
    ]);
    const queryBus = new StubQueryBus();
    queryBus.respondTo(
      GetStandardBomDetailQuery.name,
      standardBomDetailFor('1001', []),
    );
    const sut = new GetProductDailyBomsHandler(
      dashboardRepository,
      queryBus as unknown as QueryBus,
    );

    await sut.execute(new GetProductDailyBomsQuery(productId));

    expect(queryBus.executedQueries).toEqual([
      new GetStandardBomDetailQuery('1001'),
      new GetStandardBomDetailQuery('1002'),
    ]);
  });
});
