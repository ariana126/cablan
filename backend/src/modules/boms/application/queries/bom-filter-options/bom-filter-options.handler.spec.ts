import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { BomFilterOptionsHandler } from './bom-filter-options.handler';

describe('BomFilterOptionsHandler', () => {
  it('returns every distinct filterable value as a read model', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToFilterOptionsWith({
      orderNumbers: ['ORD-2001', 'ORD-2002'],
      trackingNumbers: ['TRK-3001', 'TRK-3002'],
      brands: ['Legrand', 'Nexans'],
      componentNames: ['Core', 'Sheath'],
      standardBomMiCodes: ['1001', '1002'],
      productNames: ['Product 1'],
      registeredByUsers: ['Sina', 'Mostafa'],
      approvalStatuses: [ApprovalStatus.Approved, ApprovalStatus.Pending],
      reviewers: ['مصطفی', 'یاشار'],
    });
    const sut = new BomFilterOptionsHandler(bomReportRepository);

    const result = await sut.execute();

    expect(result).toEqual({
      orderNumbers: ['ORD-2001', 'ORD-2002'],
      trackingNumbers: ['TRK-3001', 'TRK-3002'],
      brands: ['Legrand', 'Nexans'],
      componentNames: ['Core', 'Sheath'],
      standardBomMiCodes: ['1001', '1002'],
      productNames: ['Product 1'],
      registeredByUsers: ['Sina', 'Mostafa'],
      approvalStatuses: ['approved', 'pending'],
      reviewers: ['مصطفی', 'یاشار'],
    });
  });

  it('never returns a weight field', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new BomFilterOptionsHandler(bomReportRepository);

    const result = await sut.execute();

    expect(result).not.toHaveProperty('weights');
  });
});
