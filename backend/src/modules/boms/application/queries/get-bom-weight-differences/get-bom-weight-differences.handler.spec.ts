import { StandardBomWeights } from '@boms/application/service/standard-bom-weights';
import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { EntityNotFound, Identity } from '@framework/domain';
import { GetManufacturingInstructionDetailQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/get-manufacturing-instruction-detail.query';
import { ManufacturingInstructionDetail } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/manufacturing-instruction-detail.read-model';
import { QueryBus } from '@nestjs/cqrs';

import { GetBomWeightDifferencesHandler } from './get-bom-weight-differences.handler';
import { GetBomWeightDifferencesQuery } from './get-bom-weight-differences.query';

type Composition = Array<{
  id: string;
  name: string;
  materials: Array<{ id: string; name: string; weight: number }>;
}>;

function standardBom(
  miCode: string,
  components: Composition,
): ManufacturingInstructionDetail {
  return new ManufacturingInstructionDetail(
    `std-${miCode}`,
    miCode,
    'Legrand',
    'Product 1',
    305,
    true,
    null,
    components.map((component) => ({
      componentId: component.id,
      name: component.name,
      materials: component.materials.map((material) => ({
        materialId: material.id,
        name: material.name,
        weight: material.weight,
      })),
    })),
    0,
  );
}

function harness(
  daily: Composition,
  standard: Composition,
): {
  bomId: Identity;
  queryBus: StubQueryBus;
  sut: GetBomWeightDifferencesHandler;
} {
  const bomId = Identity.new();
  const bomReportRepository = new InMemoryBomReportRepository();
  bomReportRepository.seedDetail({
    id: bomId.asString(),
    standardBomId: 'std-1001',
    standardBomMiCode: '1001',
    brand: 'Legrand',
    productName: 'Product 1',
    standardLength: 305,
    orderNumber: 'ORD-1',
    trackingNumber: 'TRK-1',
    registeredBy: 'نیکروش',
    registeredAt: new Date('2026-10-22T08:00:00.000Z'),
    description: null,
    approvalStatus: ApprovalStatus.Pending,
    reviewedBy: null,
    managementNote: null,
    components: daily,
  });
  const queryBus = new StubQueryBus();
  queryBus.respondTo(
    GetManufacturingInstructionDetailQuery.name,
    standardBom('1001', standard),
  );
  const sut = new GetBomWeightDifferencesHandler(
    bomReportRepository,
    new StandardBomWeights(queryBus as unknown as QueryBus),
  );
  return { bomId, queryBus, sut };
}

describe('GetBomWeightDifferencesHandler', () => {
  it("measures every material line, in composition order, against the standard BOM's weight for the same component and material", async () => {
    const { bomId, sut } = harness(
      [
        {
          id: 'c-core',
          name: 'مغزی',
          materials: [
            { id: 'm-copper', name: 'مسی', weight: 3 },
            { id: 'm-pvc', name: 'پی وی سی', weight: 4 },
          ],
        },
        {
          id: 'c-sheath',
          name: 'روکش',
          materials: [{ id: 'm-pvc', name: 'پی وی سی', weight: 5 }],
        },
      ],
      [
        {
          id: 'c-sheath',
          name: 'روکش',
          materials: [{ id: 'm-pvc', name: 'پی وی سی', weight: 5 }],
        },
        {
          id: 'c-core',
          name: 'مغزی',
          materials: [
            { id: 'm-pvc', name: 'پی وی سی', weight: 6 },
            { id: 'm-copper', name: 'مسی', weight: 2 },
          ],
        },
      ],
    );

    const result = await sut.execute(new GetBomWeightDifferencesQuery(bomId));

    expect(result).toEqual({
      lines: [
        {
          componentId: 'c-core',
          componentName: 'مغزی',
          materialId: 'm-copper',
          materialName: 'مسی',
          actualWeight: 3,
          standardWeight: 2,
          difference: 1,
        },
        {
          componentId: 'c-core',
          componentName: 'مغزی',
          materialId: 'm-pvc',
          materialName: 'پی وی سی',
          actualWeight: 4,
          standardWeight: 6,
          difference: 2,
        },
        {
          componentId: 'c-sheath',
          componentName: 'روکش',
          materialId: 'm-pvc',
          materialName: 'پی وی سی',
          actualWeight: 5,
          standardWeight: 5,
          difference: 0,
        },
      ],
    });
  });

  it('reads the standard BOM the daily BOM was cloned from, by its MI code', async () => {
    const { bomId, queryBus, sut } = harness([], []);

    await sut.execute(new GetBomWeightDifferencesQuery(bomId));

    expect(queryBus.executedQueries).toEqual([
      new GetManufacturingInstructionDetailQuery('1001'),
    ]);
  });

  it('compares a line no longer on the standard BOM against a standard weight of 0', async () => {
    const { bomId, sut } = harness(
      [
        {
          id: 'c-core',
          name: 'مغزی',
          materials: [{ id: 'm-ghost', name: 'حذف شده', weight: 7 }],
        },
      ],
      [],
    );

    const result = await sut.execute(new GetBomWeightDifferencesQuery(bomId));

    expect(result.lines[0]).toMatchObject({ standardWeight: 0, difference: 7 });
  });

  // Asserted on the JSON the client receives: an exact float comparison is
  // what this test is about, and `toBeCloseTo` would pass the noisy value.
  it('reports a difference free of floating-point noise', async () => {
    const { bomId, sut } = harness(
      [
        {
          id: 'c-core',
          name: 'مغزی',
          materials: [{ id: 'm-copper', name: 'مسی', weight: 6.3 }],
        },
      ],
      [
        {
          id: 'c-core',
          name: 'مغزی',
          materials: [{ id: 'm-copper', name: 'مسی', weight: 6.1 }],
        },
      ],
    );

    const result = await sut.execute(new GetBomWeightDifferencesQuery(bomId));

    expect(JSON.stringify(result.lines[0].difference)).toBe('0.2');
  });

  it('rejects a daily BOM that does not exist', async () => {
    const { sut } = harness([], []);

    await expect(
      sut.execute(new GetBomWeightDifferencesQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
