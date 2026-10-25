import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';

import { ReportBomsHandler } from './report-boms.handler';
import { ReportBomsQuery } from './report-boms.query';

describe('ReportBomsHandler', () => {
  it('passes the query’s page, pageSize and filters through to the repository unchanged', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new ReportBomsHandler(bomReportRepository);

    await sut.execute(
      new ReportBomsQuery(2, 10, {
        brands: ['Legrand'],
        componentNames: [],
        approvalStatuses: [ApprovalStatus.Approved],
        reviewers: [],
      }),
    );

    expect(bomReportRepository.lastSearchCriteria).toEqual({
      page: 2,
      pageSize: 10,
      filters: {
        brands: ['Legrand'],
        componentNames: [],
        approvalStatuses: ['approved'],
        reviewers: [],
      },
    });
  });

  it('maps the repository’s result to a report page, formatting registeredAt as an ISO string', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToSearchWith({
      items: [
        {
          id: 'bom-1',
          orderNumber: 'ORD-2001',
          trackingNumber: 'TRK-3001',
          registeredAt: new Date('2026-06-22T04:00:00.000Z'),
          registeredBy: 'Sina',
          standardBomMiCode: '1001',
          brand: 'Legrand',
          productName: 'Product 1',
          approvalStatus: ApprovalStatus.Approved,
          reviewedBy: 'مصطفی',
          managementNote: 'وزن مس اصلاح شد',
        },
      ],
      total: 1,
    });
    const sut = new ReportBomsHandler(bomReportRepository);

    const result = await sut.execute(new ReportBomsQuery(1, 20, {}));

    expect(result).toEqual({
      items: [
        {
          id: 'bom-1',
          orderNumber: 'ORD-2001',
          trackingNumber: 'TRK-3001',
          registeredAt: '2026-06-22T04:00:00.000Z',
          registeredBy: 'Sina',
          standardBomMiCode: '1001',
          brand: 'Legrand',
          productName: 'Product 1',
          approvalStatus: 'approved',
          reviewedBy: 'مصطفی',
          managementNote: 'وزن مس اصلاح شد',
        },
      ],
      total: 1,
    });
  });

  it("passes an reviewer filter's '' (no reviewer) through to the repository untouched", async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new ReportBomsHandler(bomReportRepository);

    await sut.execute(new ReportBomsQuery(1, 20, { reviewers: ['مصطفی', ''] }));

    expect(bomReportRepository.lastSearchCriteria?.filters).toEqual({
      reviewers: ['مصطفی', ''],
    });
  });

  it('lists no BOMs when none match', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new ReportBomsHandler(bomReportRepository);

    const result = await sut.execute(new ReportBomsQuery(1, 20, {}));

    expect(result).toEqual({ items: [], total: 0 });
  });
});
