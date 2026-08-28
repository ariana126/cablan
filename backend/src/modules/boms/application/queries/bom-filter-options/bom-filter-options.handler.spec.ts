import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';

import { BomFilterOptionsHandler } from './bom-filter-options.handler';

describe('BomFilterOptionsHandler', () => {
  it('returns every distinct filterable value as a read model', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToFilterOptionsWith({
      brands: ['Legrand', 'Nexans'],
      componentNames: ['Core', 'Sheath'],
      standardBomMiCodes: ['1001', '1002'],
      productNames: ['Product 1'],
      registeredByUsers: ['Sina', 'Mostafa'],
    });
    const sut = new BomFilterOptionsHandler(bomReportRepository);

    const result = await sut.execute();

    expect(result).toEqual({
      brands: ['Legrand', 'Nexans'],
      componentNames: ['Core', 'Sheath'],
      standardBomMiCodes: ['1001', '1002'],
      productNames: ['Product 1'],
      registeredByUsers: ['Sina', 'Mostafa'],
    });
  });

  it('never returns a weight field', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new BomFilterOptionsHandler(bomReportRepository);

    const result = await sut.execute();

    expect(result).not.toHaveProperty('weights');
  });
});
