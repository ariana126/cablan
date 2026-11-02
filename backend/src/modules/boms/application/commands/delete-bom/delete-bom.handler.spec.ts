import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';

import { DeleteBomCommand } from './delete-bom.command';
import { DeleteBomHandler } from './delete-bom.handler';

function seedBom(bomRepository: InMemoryBomRepository): Bom {
  return bomRepository.seed(
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
          BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150)),
        ]),
      ],
    ),
  );
}

describe('DeleteBomHandler', () => {
  it('hard-deletes a BOM', async () => {
    const bomRepository = new InMemoryBomRepository();
    const sut = new DeleteBomHandler(bomRepository, new RecordDependencies([]));
    const bom = seedBom(bomRepository);

    await sut.execute(new DeleteBomCommand(bom.id));

    await expect(bomRepository.get(bom.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
  });

  it('refuses deleting a daily BOM that was re-sampled, keeping it', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository);
    const probe = new StubDependentsProbe().given(
      { type: 'Bom', id: bom.id.asString() },
      [{ kind: 'resampled-daily-bom', name: 'SO-1234' }],
    );
    const sut = new DeleteBomHandler(
      bomRepository,
      new RecordDependencies([probe]),
    );

    await expect(
      sut.execute(new DeleteBomCommand(bom.id)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await bomRepository.find(bom.id)).not.toBeNull();
  });

  it('rejects deleting a BOM that does not exist', async () => {
    const bomRepository = new InMemoryBomRepository();
    const sut = new DeleteBomHandler(bomRepository, new RecordDependencies([]));

    await expect(
      sut.execute(new DeleteBomCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
