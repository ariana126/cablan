import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { GetBomHandler } from './get-bom.handler';
import { GetBomQuery } from './get-bom.query';

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

describe('GetBomHandler', () => {
  it('gets a registered BOM’s full detail, computing the total weight across every component', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const bomId = Identity.new();
    bomReportRepository.seedDetail({
      id: bomId.asString(),
      standardBomId: 'standard-bom-1',
      standardBomMiCode: '1001',
      brand: 'Legrand',
      productName: 'Product 1',
      standardLength: 305,
      orderNumber: 'ORD-2001',
      trackingNumber: 'TRK-3001',
      registeredBy: 'Sina',
      registeredAt: new Date('2026-06-22T04:00:00.000Z'),
      description: 'Initial quality check',
      approvalStatus: ApprovalStatus.Approved,
      reviewedBy: 'مصطفی',
      managementNote: 'وزن مس اصلاح شد',
      editHistory: [],
      isLatestOfTrackingNumber: true,
      components: [
        {
          id: 'component-1',
          name: 'Core',
          materials: [
            { id: 'material-1', name: 'Copper', weight: 10 },
            { id: 'material-2', name: 'Aluminum', weight: 5 },
          ],
        },
        {
          id: 'component-2',
          name: 'Sheath',
          materials: [{ id: 'material-3', name: 'Copper', weight: 8 }],
        },
      ],
    });
    const sut = new GetBomHandler(bomReportRepository);

    const result = await sut.execute(new GetBomQuery(bomId));

    expect(result).toEqual({
      id: bomId.asString(),
      standardBomId: 'standard-bom-1',
      standardBomMiCode: '1001',
      brand: 'Legrand',
      productName: 'Product 1',
      standardLength: 305,
      orderNumber: 'ORD-2001',
      trackingNumber: 'TRK-3001',
      registeredBy: 'Sina',
      registeredAt: '2026-06-22T04:00:00.000Z',
      description: 'Initial quality check',
      components: [
        {
          id: 'component-1',
          name: 'Core',
          materials: [
            { id: 'material-1', name: 'Copper', weight: 10 },
            { id: 'material-2', name: 'Aluminum', weight: 5 },
          ],
        },
        {
          id: 'component-2',
          name: 'Sheath',
          materials: [{ id: 'material-3', name: 'Copper', weight: 8 }],
        },
      ],
      totalWeight: 23,
      approvalStatus: 'approved',
      reviewedBy: 'مصطفی',
      managementNote: 'وزن مس اصلاح شد',
      editHistory: [],
      resamplable: false,
    });
  });

  it('rejects getting a BOM that does not exist', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new GetBomHandler(bomReportRepository);

    await expect(
      sut.execute(new GetBomQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('carries the BOM’s edit details, each with its rendered heading', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const bomId = Identity.new();
    bomReportRepository.seedDetail({
      id: bomId.asString(),
      standardBomId: 'standard-bom-1',
      standardBomMiCode: '1001',
      brand: 'Legrand',
      productName: 'Product 1',
      standardLength: 305,
      orderNumber: 'ORD-2001',
      trackingNumber: 'TRK-3001',
      registeredBy: 'Sina',
      registeredAt: new Date('2026-06-22T04:00:00.000Z'),
      description: null,
      approvalStatus: ApprovalStatus.Pending,
      reviewedBy: null,
      managementNote: null,
      editHistory: [CORRECTION],
      isLatestOfTrackingNumber: true,
      components: [],
    });
    const sut = new GetBomHandler(bomReportRepository);

    const result = await sut.execute(new GetBomQuery(bomId));

    expect(result.editHistory).toEqual([CORRECTION_READ_MODEL]);
  });

  it('gets a pending BOM with no reviewer and no management note', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const bomId = Identity.new();
    bomReportRepository.seedDetail({
      id: bomId.asString(),
      standardBomId: 'standard-bom-1',
      standardBomMiCode: '1001',
      brand: 'Legrand',
      productName: 'Product 1',
      standardLength: 305,
      orderNumber: 'ORD-2001',
      trackingNumber: 'TRK-3001',
      registeredBy: 'Sina',
      registeredAt: new Date('2026-06-22T04:00:00.000Z'),
      description: null,
      approvalStatus: ApprovalStatus.Pending,
      reviewedBy: null,
      managementNote: null,
      editHistory: [],
      isLatestOfTrackingNumber: true,
      components: [],
    });
    const sut = new GetBomHandler(bomReportRepository);

    const result = await sut.execute(new GetBomQuery(bomId));

    expect(result.approvalStatus).toBe('pending');
    expect(result.reviewedBy).toBeNull();
    expect(result.managementNote).toBeNull();
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    'a rejected BOM that is the latest of its tracking number (%p) is resamplable: %p',
    async (isLatestOfTrackingNumber, resamplable) => {
      const bomReportRepository = new InMemoryBomReportRepository();
      const bomId = Identity.new();
      bomReportRepository.seedDetail({
        id: bomId.asString(),
        standardBomId: 'standard-bom-1',
        standardBomMiCode: '1001',
        brand: 'Legrand',
        productName: 'Product 1',
        standardLength: 305,
        orderNumber: 'ORD-2001',
        trackingNumber: 'TRK-3001',
        registeredBy: 'Sina',
        registeredAt: new Date('2026-06-22T04:00:00.000Z'),
        description: null,
        approvalStatus: ApprovalStatus.Rejected,
        reviewedBy: 'مصطفی',
        managementNote: 'وزن مس خارج از محدوده است',
        editHistory: [],
        isLatestOfTrackingNumber,
        components: [],
      });
      const sut = new GetBomHandler(bomReportRepository);

      const result = await sut.execute(new GetBomQuery(bomId));

      expect(result.resamplable).toBe(resamplable);
    },
  );
});
