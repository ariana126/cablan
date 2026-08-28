import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryStandardBomRepository } from '@standard-boms/application/support/in-memory-standard-bom-repository';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

import { GetStandardBomByMiCodeHandler } from './get-standard-bom-by-mi-code.handler';
import { GetStandardBomByMiCodeQuery } from './get-standard-bom-by-mi-code.query';

describe('GetStandardBomByMiCodeHandler', () => {
  it('gets a registered standard BOM by its MI code as a read model', async () => {
    const standardBomRepository = new InMemoryStandardBomRepository();
    const sut = new GetStandardBomByMiCodeHandler(standardBomRepository);
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

    const result = await sut.execute(new GetStandardBomByMiCodeQuery('1234'));

    expect(result).toEqual(
      expect.objectContaining({
        id: standardBom.id.asString(),
        miCode: '1234',
        components: [
          expect.objectContaining({
            name: 'Bolt',
            materials: [expect.objectContaining({ name: 'Steel Rod' })],
          }),
        ],
      }),
    );
  });

  it('rejects getting a standard BOM whose MI code does not resolve to an existing one', async () => {
    const standardBomRepository = new InMemoryStandardBomRepository();
    const sut = new GetStandardBomByMiCodeHandler(standardBomRepository);

    await expect(
      sut.execute(new GetStandardBomByMiCodeQuery('unknown-mi-code')),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
