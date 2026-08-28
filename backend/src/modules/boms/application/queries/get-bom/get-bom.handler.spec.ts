import { InMemoryBomReportRepository } from '@boms/application/support/in-memory-bom-report-repository';
import { EntityNotFound, Identity } from '@framework/domain';

import { GetBomHandler } from './get-bom.handler';
import { GetBomQuery } from './get-bom.query';

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
    });
  });

  it('rejects getting a BOM that does not exist', async () => {
    const bomReportRepository = new InMemoryBomReportRepository();
    const sut = new GetBomHandler(bomReportRepository);

    await expect(
      sut.execute(new GetBomQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
