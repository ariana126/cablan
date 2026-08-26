import { Identity } from '@framework/domain';
import { InMemoryStandardBomRepository } from '@standard-boms/application/support/in-memory-standard-bom-repository';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

import { ListStandardBomsHandler } from './list-standard-boms.handler';

describe('ListStandardBomsHandler', () => {
  it('lists every registered standard BOM as a read model', async () => {
    const standardBomRepository = new InMemoryStandardBomRepository();
    const sut = new ListStandardBomsHandler(standardBomRepository);
    standardBomRepository.seed(
      StandardBom.register(
        MiCode.fromString('1234'),
        Brand.fromString('Legrand'),
        StandardLength.of(305),
        true,
        undefined,
        Identity.new(),
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

    const result = await sut.execute();

    expect(result).toEqual([
      expect.objectContaining({
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
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

  it('lists no standard BOMs when none are registered', async () => {
    const standardBomRepository = new InMemoryStandardBomRepository();
    const sut = new ListStandardBomsHandler(standardBomRepository);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
