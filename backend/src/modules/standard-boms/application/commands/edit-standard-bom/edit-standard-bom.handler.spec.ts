import { EntityNotFound, Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import {
  StandardBomCompositionEntryNotFound,
  StandardBomMiCodeAlreadyExists,
  StandardBomMustHaveAtLeastOneComponent,
} from '@standard-boms/application/exceptions';
import { StandardBomCompositionFactory } from '@standard-boms/application/service/standard-bom-composition.factory';
import { InMemoryStandardBomRepository } from '@standard-boms/application/support/in-memory-standard-bom-repository';
import { StubQueryBus } from '@standard-boms/application/support/stub-query-bus';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

import { EditStandardBomCommand } from './edit-standard-bom.command';
import { EditStandardBomHandler } from './edit-standard-bom.handler';

function productReadModel(): ProductReadModel {
  return new ProductReadModel('product-1', 'Widget', [
    {
      id: 'component-1',
      name: 'Bolt',
      materials: [{ id: 'material-1', name: 'Steel Rod' }],
    },
    {
      id: 'component-2',
      name: 'Nut',
      materials: [{ id: 'material-2', name: 'Copper Wire' }],
    },
  ]);
}

function makeSut() {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(GetProductQuery.name, productReadModel());
  const standardBomRepository = new InMemoryStandardBomRepository();
  const compositionFactory = new StandardBomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new EditStandardBomHandler(
    standardBomRepository,
    compositionFactory,
  );
  return { sut, standardBomRepository };
}

function seedStandardBom(
  standardBomRepository: InMemoryStandardBomRepository,
  miCode: string,
  productId: Identity = Identity.new(),
): StandardBom {
  return standardBomRepository.seed(
    StandardBom.register(
      MiCode.fromString(miCode),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      'Original description',
      productId,
      'Widget',
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
}

describe('EditStandardBomHandler', () => {
  it('edits a standard BOM’s scalar fields, leaving its components untouched', async () => {
    const { sut, standardBomRepository } = makeSut();
    const standardBom = seedStandardBom(standardBomRepository, '1234');
    const originalComponents = standardBom.components();

    await sut.execute(
      new EditStandardBomCommand(
        standardBom.id,
        MiCode.fromString('5678'),
        Brand.fromString('Schneider'),
        StandardLength.of(500),
        'Updated description',
        false,
      ),
    );

    const saved = await standardBomRepository.get(standardBom.id);
    expect(saved.miCode().asString()).toBe('5678');
    expect(saved.brand().asString()).toBe('Schneider');
    expect(saved.standardLength().asNumber()).toBe(500);
    expect(saved.description()).toBe('Updated description');
    expect(saved.active()).toBe(false);
    expect(saved.components()).toEqual(originalComponents);
  });

  it('replaces a standard BOM’s composition wholesale, leaving its scalar fields untouched', async () => {
    const { sut, standardBomRepository } = makeSut();
    const productId = Identity.new();
    const standardBom = seedStandardBom(
      standardBomRepository,
      '1234',
      productId,
    );

    await sut.execute(
      new EditStandardBomCommand(
        standardBom.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [
          {
            componentId: 'component-2',
            materials: [{ materialId: 'material-2', weight: 200 }],
          },
        ],
      ),
    );

    const saved = await standardBomRepository.get(standardBom.id);
    expect(saved.miCode().asString()).toBe('1234');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe('component-2');
    expect(saved.components()[0].name()).toBe('Nut');
    expect(saved.components()[0].materials()[0].weight().asGrams()).toBe(200);
  });

  it('rejects editing a standard BOM to have no components', async () => {
    const { sut, standardBomRepository } = makeSut();
    const standardBom = seedStandardBom(standardBomRepository, '1234');

    await expect(
      sut.execute(
        new EditStandardBomCommand(
          standardBom.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(StandardBomMustHaveAtLeastOneComponent);
  });

  it('rejects editing a standard BOM that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditStandardBomCommand(Identity.new(), MiCode.fromString('1234')),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('rejects editing a standard BOM’s MI code to one already used by another standard BOM', async () => {
    const { sut, standardBomRepository } = makeSut();
    seedStandardBom(standardBomRepository, '1234');
    const other = seedStandardBom(standardBomRepository, '5678');

    await expect(
      sut.execute(
        new EditStandardBomCommand(other.id, MiCode.fromString('1234')),
      ),
    ).rejects.toBeInstanceOf(StandardBomMiCodeAlreadyExists);
  });

  it('allows resending a standard BOM’s own current MI code unchanged', async () => {
    const { sut, standardBomRepository } = makeSut();
    const standardBom = seedStandardBom(standardBomRepository, '1234');

    await sut.execute(
      new EditStandardBomCommand(
        standardBom.id,
        MiCode.fromString('1234'),
        Brand.fromString('Updated'),
      ),
    );

    const saved = await standardBomRepository.get(standardBom.id);
    expect(saved.miCode().asString()).toBe('1234');
    expect(saved.brand().asString()).toBe('Updated');
  });

  it("rejects a componentId that isn't part of the referenced product's current composition", async () => {
    const { sut, standardBomRepository } = makeSut();
    const standardBom = seedStandardBom(standardBomRepository, '1234');

    await expect(
      sut.execute(
        new EditStandardBomCommand(
          standardBom.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'unknown-component',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
        ),
      ),
    ).rejects.toBeInstanceOf(StandardBomCompositionEntryNotFound);
  });
});
