import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';

import { ExportBomsHandler } from './export-boms.handler';
import { ExportBomsQuery } from './export-boms.query';

describe('ExportBomsHandler', () => {
  it('passes the query’s filters through to the repository unchanged', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new ExportBomsHandler(bomReportRepository);

    await sut.execute(
      new ExportBomsQuery({ brands: ['Legrand'], componentNames: [] }),
    );

    expect(bomReportRepository.lastExportFilters).toEqual({
      brands: ['Legrand'],
      componentNames: [],
    });
  });

  it('maps every exported record to an export item, formatting registeredAt as an ISO string', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([
      {
        orderNumber: 'ORD-2001',
        trackingNumber: 'TRK-3001',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        registeredBy: 'Sina',
        standardBomMiCode: '1001',
        brand: 'Legrand',
        standardLength: 305,
        productName: 'Product 1',
        description: 'Quality check',
        components: [
          {
            name: 'Bolt',
            materials: [{ name: 'Steel Rod', weight: 150 }],
          },
        ],
      },
    ]);
    const sut = new ExportBomsHandler(bomReportRepository);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result).toEqual({
      items: [
        {
          orderNumber: 'ORD-2001',
          trackingNumber: 'TRK-3001',
          registeredAt: '2026-06-22T04:00:00.000Z',
          registeredBy: 'Sina',
          standardBomMiCode: '1001',
          brand: 'Legrand',
          standardLength: 305,
          productName: 'Product 1',
          description: 'Quality check',
          components: [
            {
              name: 'Bolt',
              materials: [{ name: 'Steel Rod', weight: 150 }],
            },
          ],
        },
      ],
    });
  });

  it('carries a null description through unchanged', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([
      {
        orderNumber: 'ORD-2001',
        trackingNumber: 'TRK-3001',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        registeredBy: 'Sina',
        standardBomMiCode: '1001',
        brand: 'Legrand',
        standardLength: 305,
        productName: 'Product 1',
        description: null,
        components: [],
      },
    ]);
    const sut = new ExportBomsHandler(bomReportRepository);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result.items[0].description).toBeNull();
  });

  it('exports no BOMs when none match', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new ExportBomsHandler(bomReportRepository);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result).toEqual({ items: [] });
  });
});
