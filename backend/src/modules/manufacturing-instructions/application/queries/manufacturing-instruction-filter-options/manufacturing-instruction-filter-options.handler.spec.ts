import {
  ManufacturingInstructionFilterOptionsRecord,
  ManufacturingInstructionReportItemRecord,
  ManufacturingInstructionReportRepository,
  ManufacturingInstructionReportSearchResult,
} from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';

import { ManufacturingInstructionFilterOptionsHandler } from './manufacturing-instruction-filter-options.handler';

describe('ManufacturingInstructionFilterOptionsHandler', () => {
  it('returns every distinct filterable value as a read model', async () => {
    const repository = new InMemoryManufacturingInstructionReportRepository();
    repository.respondToFilterOptionsWith({
      brands: ['Legrand', 'Nexans'],
      activeStatuses: [true, false],
      productNames: ['Product 1'],
      componentNames: ['Core', 'Sheath'],
      miCodes: ['1001', '1002'],
    });
    const sut = new ManufacturingInstructionFilterOptionsHandler(repository);

    const result = await sut.execute();

    expect(result).toEqual({
      brands: ['Legrand', 'Nexans'],
      activeStatuses: [true, false],
      productNames: ['Product 1'],
      componentNames: ['Core', 'Sheath'],
      miCodes: ['1001', '1002'],
    });
  });

  it('never returns a weight field', async () => {
    const repository = new InMemoryManufacturingInstructionReportRepository();
    const sut = new ManufacturingInstructionFilterOptionsHandler(repository);

    const result = await sut.execute();

    expect(result).not.toHaveProperty('weights');
  });
});

class InMemoryManufacturingInstructionReportRepository extends ManufacturingInstructionReportRepository {
  private filterOptionsResult: ManufacturingInstructionFilterOptionsRecord = {
    brands: [],
    activeStatuses: [],
    productNames: [],
    componentNames: [],
    miCodes: [],
  };

  respondToFilterOptionsWith(
    result: ManufacturingInstructionFilterOptionsRecord,
  ): void {
    this.filterOptionsResult = result;
  }

  filterOptions(): Promise<ManufacturingInstructionFilterOptionsRecord> {
    return Promise.resolve(this.filterOptionsResult);
  }

  search(): Promise<ManufacturingInstructionReportSearchResult> {
    return Promise.resolve({ items: [], total: 0 });
  }

  findDetailById(): Promise<ManufacturingInstructionReportItemRecord | null> {
    return Promise.resolve(null);
  }
}
