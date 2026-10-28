import { BomReportItemRecord } from '@boms/application/service/bom-report.repository';
import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';

import { ReportBomsHandler } from './report-boms.handler';
import { ReportBomsQuery } from './report-boms.query';

// A correction made at 1403/06/15 10:00 in Tehran (UTC+03:30).
const CORRECTION = BomEditRecord.of(
  'نیکروش',
  new Date('2024-09-05T06:30:00.000Z'),
  'خطای ترازو',
  ['شماره ردیابی از TRK-1 به TRK-2 تغییر کرد'],
);
const CORRECTION_READ_MODEL = {
  editedBy: 'نیکروش',
  editedAt: '2024-09-05T06:30:00.000Z',
  reason: 'خطای ترازو',
  heading:
    'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
  changes: ['شماره ردیابی از TRK-1 به TRK-2 تغییر کرد'],
};

function reportRecord(
  overrides: Partial<BomReportItemRecord> = {},
): BomReportItemRecord {
  return {
    id: 'bom-1',
    orderNumber: 'ORD-2001',
    trackingNumber: 'TRK-3001',
    registeredAt: new Date('2026-06-22T04:00:00.000Z'),
    registeredBy: 'Sina',
    standardBomMiCode: '1001',
    brand: 'Legrand',
    productName: 'Product 1',
    approvalStatus: ApprovalStatus.Rejected,
    reviewedBy: 'مصطفی',
    managementNote: 'وزن مس خارج از محدوده است',
    editHistory: [],
    isLatestOfTrackingNumber: true,
    ...overrides,
  };
}

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
          editHistory: [],
          isLatestOfTrackingNumber: true,
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
          editHistory: [],
          resamplable: false,
        },
      ],
      total: 1,
    });
  });

  it('carries each row’s edit details, oldest first, each with its rendered heading', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToSearchWith({
      items: [reportRecord({ editHistory: [CORRECTION] })],
      total: 1,
    });
    const sut = new ReportBomsHandler(bomReportRepository);

    const result = await sut.execute(new ReportBomsQuery(1, 20, {}));

    expect(result.items[0].editHistory).toEqual([CORRECTION_READ_MODEL]);
  });

  it.each([
    [ApprovalStatus.Rejected, true, true],
    [ApprovalStatus.Rejected, false, false],
    [ApprovalStatus.Approved, true, false],
    [ApprovalStatus.Pending, true, false],
  ])(
    'a %s row that is the latest of its tracking number (%p) is resamplable: %p',
    async (approvalStatus, isLatestOfTrackingNumber, resamplable) => {
      const bomReportRepository = new InMemoryBomReportRepository();
      bomReportRepository.respondToSearchWith({
        items: [reportRecord({ approvalStatus, isLatestOfTrackingNumber })],
        total: 1,
      });
      const sut = new ReportBomsHandler(bomReportRepository);

      const result = await sut.execute(new ReportBomsQuery(1, 20, {}));

      expect(result.items[0].resamplable).toBe(resamplable);
    },
  );

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
