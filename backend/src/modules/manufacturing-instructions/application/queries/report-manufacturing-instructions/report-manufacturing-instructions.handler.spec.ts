import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';

import { ReportManufacturingInstructionsHandler } from './report-manufacturing-instructions.handler';
import { ReportManufacturingInstructionsQuery } from './report-manufacturing-instructions.query';

describe('ReportManufacturingInstructionsHandler', () => {
  it('passes page, pageSize and filters through to the repository', async () => {
    const repository = {
      search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const sut = new ReportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    await sut.execute(
      new ReportManufacturingInstructionsQuery(
        2,
        10,
        'search',
        ['برند۱'],
        [true],
        ['محصول۱'],
        ['جز۱'],
        ['1002'],
        'productName',
        'asc',
      ),
    );

    expect(repository.search).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      filters: {
        brands: ['برند۱'],
        activeStatuses: [true],
        productNames: ['محصول۱'],
        componentNames: ['جز۱'],
        miCodes: ['1002'],
      },
      sortBy: 'productName',
      sortDir: 'asc',
    });
  });

  it('maps repository result to a report page', async () => {
    const repository = {
      search: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'bom-1',
            miCode: '1234',
            brand: 'Legrand',
            productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
            active: true,
          },
          {
            id: 'bom-2',
            miCode: '5678',
            brand: 'Schneider',
            productName: 'کابل برق NYY 3x2.5',
            active: false,
          },
        ],
        total: 2,
      }),
    };
    const sut = new ReportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    const result = await sut.execute(
      new ReportManufacturingInstructionsQuery(0, 10),
    );

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].miCode).toBe('1234');
    expect(result.items[1].active).toBe(false);
  });

  it('returns empty page when no results', async () => {
    const repository = {
      search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const sut = new ReportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    const result = await sut.execute(
      new ReportManufacturingInstructionsQuery(0, 10),
    );

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
