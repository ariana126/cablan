import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';

import { ExportManufacturingInstructionsHandler } from './export-manufacturing-instructions.handler';
import { ExportManufacturingInstructionsQuery } from './export-manufacturing-instructions.query';

describe('ExportManufacturingInstructionsHandler', () => {
  it('passes the query’s filters through to the repository unchanged', async () => {
    const repository = {
      exportRecords: jest.fn().mockResolvedValue([]),
    };
    const sut = new ExportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    await sut.execute(
      new ExportManufacturingInstructionsQuery({
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
    const sut = new ExportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    const result = await sut.execute(
      new ExportManufacturingInstructionsQuery({}),
    );

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
    const sut = new ExportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    const result = await sut.execute(
      new ExportManufacturingInstructionsQuery({}),
    );

    expect(result.items[0].description).toBeNull();
  });

  it('exports no standard BOMs when none match', async () => {
    const repository = {
      exportRecords: jest.fn().mockResolvedValue([]),
    };
    const sut = new ExportManufacturingInstructionsHandler(
      repository as unknown as ManufacturingInstructionReportRepository,
    );

    const result = await sut.execute(
      new ExportManufacturingInstructionsQuery({}),
    );

    expect(result).toEqual({ items: [] });
  });
});
