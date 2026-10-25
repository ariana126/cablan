import { BomExportRecord } from '@boms/application/service/bom-report.repository';
import { StandardBomWeights } from '@boms/application/service/standard-bom-weights';
import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { EntityNotFound, Identity } from '@framework/domain';
import { GetManufacturingInstructionDetailQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/get-manufacturing-instruction-detail.query';
import { ManufacturingInstructionDetail } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/manufacturing-instruction-detail.read-model';
import { QueryBus } from '@nestjs/cqrs';

import { ExportBomsHandler } from './export-boms.handler';
import { ExportBomsQuery } from './export-boms.query';

// A standard BOM whose current materials weigh `weights`, one component each.
function standardBomWeighing(
  ...weights: number[]
): ManufacturingInstructionDetail {
  return new ManufacturingInstructionDetail(
    'std-1001',
    '1001',
    'Legrand',
    'Product 1',
    305,
    true,
    null,
    weights.map((weight, index) => ({
      componentId: `component-${index}`,
      name: `Component ${index}`,
      materials: [{ materialId: `material-${index}`, name: 'Copper', weight }],
    })),
    weights.reduce((sum, weight) => sum + weight, 0),
  );
}

function exportRecord(
  overrides: Partial<BomExportRecord> = {},
): BomExportRecord {
  return {
    orderNumber: 'ORD-2001',
    trackingNumber: 'TRK-3001',
    registeredAt: new Date('2026-06-22T04:00:00.000Z'),
    registeredBy: 'Sina',
    standardBomMiCode: '1001',
    brand: 'Legrand',
    standardLength: 305,
    productName: 'Product 1',
    description: 'Quality check',
    approvalStatus: ApprovalStatus.Approved,
    reviewedBy: 'مصطفی',
    managementNote: 'وزن مس اصلاح شد',
    components: [
      { name: 'Bolt', materials: [{ name: 'Steel Rod', weight: 0.4237 }] },
    ],
    ...overrides,
  };
}

function handlerOver(
  bomReportRepository: InMemoryBomReportRepository,
  queryBus: StubQueryBus = standardBomsWeighing(0.4),
): ExportBomsHandler {
  return new ExportBomsHandler(
    bomReportRepository,
    new StandardBomWeights(queryBus as unknown as QueryBus),
  );
}

function standardBomsWeighing(...weights: number[]): StubQueryBus {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(
    GetManufacturingInstructionDetailQuery.name,
    standardBomWeighing(...weights),
  );
  return queryBus;
}

describe('ExportBomsHandler', () => {
  it('passes the query’s filters through to the repository unchanged', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = handlerOver(bomReportRepository);

    await sut.execute(
      new ExportBomsQuery({
        brands: ['Legrand'],
        componentNames: [],
        approvalStatuses: [ApprovalStatus.Pending],
        reviewers: ['مصطفی'],
      }),
    );

    expect(bomReportRepository.lastExportFilters).toEqual({
      brands: ['Legrand'],
      componentNames: [],
      approvalStatuses: ['pending'],
      reviewers: ['مصطفی'],
    });
  });

  it('maps every exported record to an export item, formatting registeredAt as an ISO string', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([exportRecord()]);
    const sut = handlerOver(bomReportRepository);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result).toEqual({
      items: [
        {
          orderNumber: 'ORD-2001',
          trackingNumber: 'TRK-3001',
          registeredAt: '2026-06-22T04:00:00.000Z',
          registeredBy: 'Sina',
          standardBomMiCode: '1001',
          brand: 'Legrand',
          standardLength: 305,
          productName: 'Product 1',
          description: 'Quality check',
          approvalStatus: 'approved',
          reviewedBy: 'مصطفی',
          managementNote: 'وزن مس اصلاح شد',
          weightPerMeter: 0.4237,
          standardLengthWeight: 129.2285,
          differenceFromStandard: 7.2285,
          components: [
            {
              name: 'Bolt',
              materials: [{ name: 'Steel Rod', weight: 0.4237 }],
            },
          ],
        },
      ],
    });
  });

  it('weighs one metre as the sum of every material weight, across components', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([
      exportRecord({
        standardLength: 100,
        components: [
          {
            name: 'Core',
            materials: [
              { name: 'Copper', weight: 0.1 },
              { name: 'Aluminium', weight: 0.2 },
            ],
          },
          { name: 'Jacket', materials: [{ name: 'PVC', weight: 0.15 }] },
        ],
      }),
    ]);
    const sut = handlerOver(bomReportRepository, standardBomsWeighing(0.45));

    const result = await sut.execute(new ExportBomsQuery({}));

    // Exact, not `toBeCloseTo`: the sums must come out free of float noise.
    expect(result.items[0]).toMatchObject({
      weightPerMeter: 0.45,
      standardLengthWeight: 45,
      differenceFromStandard: 0,
    });
  });

  it('signs the difference negative when the daily BOM is lighter than its standard BOM', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([exportRecord()]);
    const sut = handlerOver(
      bomReportRepository,
      standardBomsWeighing(0.3, 0.2),
    );

    const result = await sut.execute(new ExportBomsQuery({}));

    // 0.4237 × 305 − 0.5 × 305
    expect(result.items[0]).toMatchObject({ differenceFromStandard: -23.2715 });
  });

  it('leaves the difference empty when the standard BOM can no longer be found, rather than failing the export', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([exportRecord()]);
    const queryBus = new StubQueryBus();
    queryBus.rejectWith(
      GetManufacturingInstructionDetailQuery.name,
      EntityNotFound.withId(Identity.fromString('1001')),
    );
    const sut = handlerOver(bomReportRepository, queryBus);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result.items[0]).toMatchObject({
      weightPerMeter: 0.4237,
      standardLengthWeight: 129.2285,
      differenceFromStandard: null,
    });
  });

  it('lets any other failure to read the standard BOM fail the export', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([exportRecord()]);
    const queryBus = new StubQueryBus();
    queryBus.rejectWith(
      GetManufacturingInstructionDetailQuery.name,
      new Error('connection lost'),
    );
    const sut = handlerOver(bomReportRepository, queryBus);

    await expect(sut.execute(new ExportBomsQuery({}))).rejects.toThrow(
      'connection lost',
    );
  });

  it('reads each distinct standard BOM once', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([
      exportRecord({ standardBomMiCode: '1001' }),
      exportRecord({ standardBomMiCode: '1001' }),
      exportRecord({ standardBomMiCode: '1002' }),
    ]);
    const queryBus = standardBomsWeighing(0.4);
    const sut = handlerOver(bomReportRepository, queryBus);

    await sut.execute(new ExportBomsQuery({}));

    expect(queryBus.executedQueries).toEqual([
      new GetManufacturingInstructionDetailQuery('1001'),
      new GetManufacturingInstructionDetailQuery('1002'),
    ]);
  });

  it('carries a null description through unchanged', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    bomReportRepository.respondToExportWith([
      exportRecord({
        description: null,
        approvalStatus: ApprovalStatus.Pending,
        reviewedBy: null,
        managementNote: null,
      }),
    ]);
    const sut = handlerOver(bomReportRepository);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result.items[0].description).toBeNull();
  });

  it("passes an reviewer filter's '' (no reviewer) through to the repository untouched", async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = handlerOver(bomReportRepository);

    await sut.execute(new ExportBomsQuery({ reviewers: [''] }));

    expect(bomReportRepository.lastExportFilters).toEqual({ reviewers: [''] });
  });

  it('exports no BOMs when none match', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = handlerOver(bomReportRepository);

    const result = await sut.execute(new ExportBomsQuery({}));

    expect(result).toEqual({ items: [] });
  });
});
