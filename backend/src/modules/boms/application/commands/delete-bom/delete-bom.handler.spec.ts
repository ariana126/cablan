import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { DeleteBomCommand } from './delete-bom.command';
import { DeleteBomHandler } from './delete-bom.handler';

describe('DeleteBomHandler', () => {
  it('hard-deletes a BOM', async () => {
    const bomRepository = new InMemoryBomRepository();
    const sut = new DeleteBomHandler(bomRepository);
    const bom = bomRepository.seed(
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

    await sut.execute(new DeleteBomCommand(bom.id));

    await expect(bomRepository.get(bom.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
  });

  it('rejects deleting a BOM that does not exist', async () => {
    const bomRepository = new InMemoryBomRepository();
    const sut = new DeleteBomHandler(bomRepository);

    await expect(
      sut.execute(new DeleteBomCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
