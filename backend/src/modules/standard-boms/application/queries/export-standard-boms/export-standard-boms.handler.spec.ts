import { StandardBomReportRepository } from '@standard-boms/application/service/standard-bom-report.repository';

import { ExportStandardBomsHandler } from './export-standard-boms.handler';
import { ExportStandardBomsQuery } from './export-standard-boms.query';

describe('ExportStandardBomsHandler', () => {
  it('passes the query’s filters through to the repository unchanged', async () => {
    const repository = {
      exportRecords: jest.fn().mockResolvedValue([]),
    };
    const sut = new ExportStandardBomsHandler(
      repository as unknown as StandardBomReportRepository,
    );

    await sut.execute(
      new ExportStandardBomsQuery({
        brands: ['Legrand'],
        componentNames: [],
        miCodes: ['1002'],
      }),
    );

    expect(repository.exportRecords).toHaveBeenCalledWith({
      brands: ['Legrand'],
      componentNames: [],
      miCodes: ['1002'],
    });
  });

  it('maps every exported record to an export item', async () => {
    const repository = {
      exportRecords: jest.fn().mockResolvedValue([
        {
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
        },
      ]),
    };
    const sut = new ExportStandardBomsHandler(
      repository as unknown as StandardBomReportRepository,
    );

    const result = await sut.execute(new ExportStandardBomsQuery({}));

    expect(result).toEqual({
      items: [
        {
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
        },
      ],
    });
  });

  it('carries a null description through unchanged', async () => {
    const repository = {
      exportRecords: jest.fn().mockResolvedValue([
        {
          miCode: '1001',
          brand: 'Legrand',
          standardLength: 305,
          active: true,
          productName: 'Product 1',
          description: null,
          components: [],
        },
      ]),
    };
    const sut = new ExportStandardBomsHandler(
      repository as unknown as StandardBomReportRepository,
    );

    const result = await sut.execute(new ExportStandardBomsQuery({}));

    expect(result.items[0].description).toBeNull();
  });

  it('exports no standard BOMs when none match', async () => {
    const repository = {
      exportRecords: jest.fn().mockResolvedValue([]),
    };
    const sut = new ExportStandardBomsHandler(
      repository as unknown as StandardBomReportRepository,
    );

    const result = await sut.execute(new ExportStandardBomsQuery({}));

    expect(result).toEqual({ items: [] });
  });
});
