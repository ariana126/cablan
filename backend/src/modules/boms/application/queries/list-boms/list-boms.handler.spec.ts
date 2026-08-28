import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { Identity } from '@framework/domain';

import { ListBomsHandler } from './list-boms.handler';

describe('ListBomsHandler', () => {
  it('lists every registered BOM as a read model', async () => {
    const bomRepository = new InMemoryBomRepository();
    const sut = new ListBomsHandler(bomRepository);
    bomRepository.seed(
      Bom.register(
        Identity.new(),
        '1234',
        'Legrand',
        'Product 1',
        305,
        OrderNumber.fromString('SO-1234'),
        TrackingNumber.fromString('TN-5678'),
        undefined,
        'Sina',
        [
          BomComponentLine.of(Identity.new(), 'Bolt', [
            BomMaterialLine.of(
              Identity.new(),
              'Steel Rod',
              Weight.ofGrams(150),
            ),
          ]),
        ],
      ),
    );

    const result = await sut.execute();

    expect(result).toEqual([
      expect.objectContaining({
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        components: [
          expect.objectContaining({
            name: 'Bolt',
            materials: [
              expect.objectContaining({ name: 'Steel Rod', weight: 150 }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('lists no BOMs when none are registered', async () => {
    const bomRepository = new InMemoryBomRepository();
    const sut = new ListBomsHandler(bomRepository);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
