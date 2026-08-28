import { BomMustHaveAtLeastOneComponent } from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetStandardBomByMiCodeQuery } from '@standard-boms/application/queries/get-standard-bom-by-mi-code/get-standard-bom-by-mi-code.query';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';

import { EditBomCommand } from './edit-bom.command';
import { EditBomHandler } from './edit-bom.handler';

function standardBomReadModel(): StandardBomReadModel {
  return new StandardBomReadModel(
    Identity.new().asString(),
    '1234',
    'Legrand',
    305,
    true,
    undefined,
    'product-1',
    'Product 1',
    [
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
      {
        id: 'component-2',
        name: 'Nut',
        materials: [{ id: 'material-2', name: 'Copper Wire', weight: 100 }],
      },
    ],
  );
}

function makeSut() {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(GetStandardBomByMiCodeQuery.name, standardBomReadModel());
  const bomRepository = new InMemoryBomRepository();
  const compositionFactory = new BomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new EditBomHandler(bomRepository, compositionFactory);
  return { sut, bomRepository };
}

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
      'Original description',
      'Sina',
      [
        BomComponentLine.of(Identity.new(), 'Bolt', [
          BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150)),
        ]),
      ],
    ),
  );
}

describe('EditBomHandler', () => {
  it('edits a BOM’s scalar fields, leaving its components untouched', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    const originalComponents = bom.components();

    await sut.execute(
      new EditBomCommand(
        bom.id,
        OrderNumber.fromString('SO-9999'),
        TrackingNumber.fromString('TN-0000'),
        'Updated description',
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.orderNumber().asString()).toBe('SO-9999');
    expect(saved.trackingNumber().asString()).toBe('TN-0000');
    expect(saved.description()).toBe('Updated description');
    expect(saved.components()).toEqual(originalComponents);
    expect(saved.standardBomMiCode()).toBe('1234');
    expect(saved.brand()).toBe('Legrand');
    expect(saved.productName()).toBe('Product 1');
    expect(saved.standardLength()).toBe(305);
    expect(saved.registeredBy()).toBe('Sina');
  });

  it('replaces a BOM’s composition wholesale, leaving its scalar fields untouched', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await sut.execute(
      new EditBomCommand(
        bom.id,
        undefined,
        undefined,
        undefined,
        [
          {
            componentId: 'component-2',
            materials: [{ materialId: 'material-2', weight: 200 }],
          },
        ],
        '1234',
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.orderNumber().asString()).toBe('SO-1234');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe('component-2');
    expect(saved.components()[0].name()).toBe('Nut');
    expect(saved.components()[0].materials()[0].weight().asGrams()).toBe(200);
  });

  it('rejects editing a BOM to have no components', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(bom.id, undefined, undefined, undefined, [], '1234'),
      ),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
  });

  it('rejects editing a BOM that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new EditBomCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it("rejects a componentId that isn't part of the referenced standard BOM's current composition", async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'unknown-component',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
          '1234',
        ),
      ),
    ).rejects.toThrow();
  });

  it('rejects replacing a BOM’s composition without a standardBomMiCode to reclone from', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(bom.id, undefined, undefined, undefined, [
          {
            componentId: 'component-2',
            materials: [{ materialId: 'material-2', weight: 200 }],
          },
        ]),
      ),
    ).rejects.toThrow(
      'standardBomMiCode is required when components is provided',
    );
  });
});
