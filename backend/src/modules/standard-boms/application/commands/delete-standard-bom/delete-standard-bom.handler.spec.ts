import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryStandardBomRepository } from '@standard-boms/application/support/in-memory-standard-bom-repository';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

import { DeleteStandardBomCommand } from './delete-standard-bom.command';
import { DeleteStandardBomHandler } from './delete-standard-bom.handler';

describe('DeleteStandardBomHandler', () => {
  it('hard-deletes a standard BOM', async () => {
    const standardBomRepository = new InMemoryStandardBomRepository();
    const sut = new DeleteStandardBomHandler(standardBomRepository);
    const standardBom = standardBomRepository.seed(
      StandardBom.register(
        MiCode.fromString('1234'),
        Brand.fromString('Legrand'),
        StandardLength.of(305),
        true,
        undefined,
        Identity.new(),
        'Product 1',
        [
          StandardBomComponentLine.of(Identity.new(), 'Bolt', [
            StandardBomMaterialLine.of(
              Identity.new(),
              'Steel Rod',
              Weight.ofGrams(150),
            ),
          ]),
        ],
      ),
    );

    await sut.execute(new DeleteStandardBomCommand(standardBom.id));

    await expect(
      standardBomRepository.get(standardBom.id),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('rejects deleting a standard BOM that does not exist', async () => {
    const standardBomRepository = new InMemoryStandardBomRepository();
    const sut = new DeleteStandardBomHandler(standardBomRepository);

    await expect(
      sut.execute(new DeleteStandardBomCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
