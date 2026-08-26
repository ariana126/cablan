import { Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import {
  StandardBomComponentMustHaveAtLeastOneMaterial,
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

import { RegisterStandardBomCommand } from './register-standard-bom.command';
import { RegisterStandardBomHandler } from './register-standard-bom.handler';

function productReadModel(): ProductReadModel {
  return new ProductReadModel('product-1', 'Widget', [
    {
      id: 'component-1',
      name: 'Bolt',
      materials: [{ id: 'material-1', name: 'Steel Rod' }],
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
  const sut = new RegisterStandardBomHandler(
    standardBomRepository,
    compositionFactory,
  );
  return { sut, standardBomRepository, queryBus };
}

describe('RegisterStandardBomHandler', () => {
  it('registers a new standard BOM, cloning the referenced composition and attaching the given weight', async () => {
    const { sut, standardBomRepository } = makeSut();
    const productId = Identity.new();

    const result = await sut.execute(
      new RegisterStandardBomCommand(
        productId,
        MiCode.fromString('1234'),
        Brand.fromString('Legrand'),
        StandardLength.of(305),
        true,
        undefined,
        [
          {
            componentId: 'component-1',
            materials: [{ materialId: 'material-1', weight: 150 }],
          },
        ],
      ),
    );

    expect(result.miCode).toBe('1234');
    expect(result.brand).toBe('Legrand');
    expect(result.standardLength).toBe(305);
    expect(result.active).toBe(true);
    expect(result.productId).toBe(productId.asString());
    expect(result.components).toEqual([
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
    ]);
    const saved = await standardBomRepository.get(
      Identity.fromString(result.id),
    );
    expect(saved.miCode().asString()).toBe('1234');
  });

  it('rejects registering a standard BOM with no components', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterStandardBomCommand(
          Identity.new(),
          MiCode.fromString('1234'),
          Brand.fromString('Legrand'),
          StandardLength.of(305),
          true,
          undefined,
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(StandardBomMustHaveAtLeastOneComponent);
  });

  it('rejects registering a standard BOM whose component has no materials', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterStandardBomCommand(
          Identity.new(),
          MiCode.fromString('1234'),
          Brand.fromString('Legrand'),
          StandardLength.of(305),
          true,
          undefined,
          [{ componentId: 'component-1', materials: [] }],
        ),
      ),
    ).rejects.toBeInstanceOf(StandardBomComponentMustHaveAtLeastOneMaterial);
  });

  it('rejects registering a standard BOM with an already-used MI code', async () => {
    const { sut, standardBomRepository } = makeSut();
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

    await expect(
      sut.execute(
        new RegisterStandardBomCommand(
          Identity.new(),
          MiCode.fromString('1234'),
          Brand.fromString('Legrand'),
          StandardLength.of(305),
          true,
          undefined,
          [
            {
              componentId: 'component-1',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
        ),
      ),
    ).rejects.toBeInstanceOf(StandardBomMiCodeAlreadyExists);
  });
});
