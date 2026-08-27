import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomMustHaveAtLeastOneComponent,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetStandardBomByMiCodeQuery } from '@standard-boms/application/queries/get-standard-bom-by-mi-code/get-standard-bom-by-mi-code.query';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';

import { RegisterBomCommand } from './register-bom.command';
import { RegisterBomHandler } from './register-bom.handler';

function standardBomReadModel(standardBomId: string): StandardBomReadModel {
  return new StandardBomReadModel(
    standardBomId,
    '1234',
    'Legrand',
    305,
    true,
    undefined,
    'product-1',
    [
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
    ],
  );
}

function makeSut(standardBomId: string = Identity.new().asString()) {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(
    GetStandardBomByMiCodeQuery.name,
    standardBomReadModel(standardBomId),
  );
  const bomRepository = new InMemoryBomRepository();
  const compositionFactory = new BomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new RegisterBomHandler(bomRepository, compositionFactory);
  return { sut, bomRepository, queryBus };
}

describe('RegisterBomHandler', () => {
  it('registers a new BOM, cloning the referenced composition and attaching the given weight', async () => {
    const standardBomId = Identity.new().asString();
    const { sut, bomRepository } = makeSut(standardBomId);

    const result = await sut.execute(
      new RegisterBomCommand(
        '1234',
        OrderNumber.fromString('SO-1234'),
        TrackingNumber.fromString('TN-5678'),
        undefined,
        [
          {
            componentId: 'component-1',
            materials: [{ materialId: 'material-1', weight: 150 }],
          },
        ],
      ),
    );

    expect(result.standardBomId).toBe(standardBomId);
    expect(result.orderNumber).toBe('SO-1234');
    expect(result.trackingNumber).toBe('TN-5678');
    expect(result.components).toEqual([
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
    ]);
    const saved = await bomRepository.get(Identity.fromString(result.id));
    expect(saved.orderNumber().asString()).toBe('SO-1234');
  });

  it('rejects registering a BOM with no components', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterBomCommand(
          '1234',
          OrderNumber.fromString('SO-1234'),
          TrackingNumber.fromString('TN-5678'),
          undefined,
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
  });

  it('rejects registering a BOM whose component has no materials', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterBomCommand(
          '1234',
          OrderNumber.fromString('SO-1234'),
          TrackingNumber.fromString('TN-5678'),
          undefined,
          [{ componentId: 'component-1', materials: [] }],
        ),
      ),
    ).rejects.toBeInstanceOf(BomComponentMustHaveAtLeastOneMaterial);
  });

  it('rejects registering a BOM against an MI code that does not resolve to an existing standard BOM', async () => {
    const queryBus = new StubQueryBus();
    queryBus.rejectWith(
      GetStandardBomByMiCodeQuery.name,
      EntityNotFound.withId(Identity.new()),
    );
    const bomRepository = new InMemoryBomRepository();
    const compositionFactory = new BomCompositionFactory(
      queryBus as unknown as QueryBus,
    );
    const sut = new RegisterBomHandler(bomRepository, compositionFactory);

    await expect(
      sut.execute(
        new RegisterBomCommand(
          'unknown-mi-code',
          OrderNumber.fromString('SO-1234'),
          TrackingNumber.fromString('TN-5678'),
          undefined,
          [
            {
              componentId: 'component-1',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
        ),
      ),
    ).rejects.toBeInstanceOf(BomStandardBomNotFound);
  });
});
