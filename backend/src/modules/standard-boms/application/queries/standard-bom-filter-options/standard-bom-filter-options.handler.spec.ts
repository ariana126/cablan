import {
  StandardBomFilterOptionsRecord,
  StandardBomReportItemRecord,
  StandardBomReportRepository,
  StandardBomReportSearchResult,
} from '@standard-boms/application/service/standard-bom-report.repository';

import { StandardBomFilterOptionsHandler } from './standard-bom-filter-options.handler';

describe('StandardBomFilterOptionsHandler', () => {
  it('returns every distinct filterable value as a read model', async () => {
    const repository = new InMemoryStandardBomReportRepository();
    repository.respondToFilterOptionsWith({
      brands: ['Legrand', 'Nexans'],
      activeStatuses: [true, false],
      productNames: ['Product 1'],
      componentNames: ['Core', 'Sheath'],
    });
    const sut = new StandardBomFilterOptionsHandler(repository);

    const result = await sut.execute();

    expect(result).toEqual({
      brands: ['Legrand', 'Nexans'],
      activeStatuses: [true, false],
      productNames: ['Product 1'],
      componentNames: ['Core', 'Sheath'],
    });
  });

  it('never returns a weight field', async () => {
    const repository = new InMemoryStandardBomReportRepository();
    const sut = new StandardBomFilterOptionsHandler(repository);

    const result = await sut.execute();

    expect(result).not.toHaveProperty('weights');
  });
});

class InMemoryStandardBomReportRepository extends StandardBomReportRepository {
  private filterOptionsResult: StandardBomFilterOptionsRecord = {
    brands: [],
    activeStatuses: [],
    productNames: [],
    componentNames: [],
  };

  respondToFilterOptionsWith(result: StandardBomFilterOptionsRecord): void {
    this.filterOptionsResult = result;
  }

  filterOptions(): Promise<StandardBomFilterOptionsRecord> {
    return Promise.resolve(this.filterOptionsResult);
  }

  search(): Promise<StandardBomReportSearchResult> {
    return Promise.resolve({ items: [], total: 0 });
  }

  findDetailById(): Promise<StandardBomReportItemRecord | null> {
    return Promise.resolve(null);
  }
}
