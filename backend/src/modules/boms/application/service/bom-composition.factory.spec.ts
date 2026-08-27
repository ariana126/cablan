import {
  BomCompositionEntryNotFound,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { EntityNotFound, Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetStandardBomByMiCodeQuery } from '@standard-boms/application/queries/get-standard-bom-by-mi-code/get-standard-bom-by-mi-code.query';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';

import { BomCompositionFactory } from './bom-composition.factory';

function makeSut() {
  const queryBus = new StubQueryBus();
  const sut = new BomCompositionFactory(queryBus as unknown as QueryBus);
  return { sut, queryBus };
}

function standardBomWith(
  standardBomId: string,
  componentId: string,
  materialId: string,
): StandardBomReadModel {
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
        id: componentId,
        name: 'Bolt',
        materials: [{ id: materialId, name: 'Steel Rod', weight: 150 }],
      },
    ],
  );
}

describe('BomCompositionFactory', () => {
  it("clones the referenced component and material's id and name, attaching the given weight, alongside the resolved standard BOM id", async () => {
    const { sut, queryBus } = makeSut();
    const standardBomId = Identity.new().asString();
    queryBus.respondTo(
      GetStandardBomByMiCodeQuery.name,
      standardBomWith(standardBomId, 'component-1', 'material-1'),
    );

    const result = await sut.buildComposition('1234', [
      {
        componentId: 'component-1',
        materials: [{ materialId: 'material-1', weight: 200 }],
      },
    ]);

    expect(result.standardBomId.asString()).toBe(standardBomId);
    expect(result.componentLines).toHaveLength(1);
    expect(result.componentLines[0].componentId().asString()).toBe(
      'component-1',
    );
    expect(result.componentLines[0].name()).toBe('Bolt');
    expect(result.componentLines[0].materials()).toHaveLength(1);
    expect(
      result.componentLines[0].materials()[0].materialId().asString(),
    ).toBe('material-1');
    expect(result.componentLines[0].materials()[0].name()).toBe('Steel Rod');
    expect(result.componentLines[0].materials()[0].weight().asGrams()).toBe(
      200,
    );
  });

  it('dispatches a GetStandardBomByMiCodeQuery for the given MI code', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      GetStandardBomByMiCodeQuery.name,
      standardBomWith(Identity.new().asString(), 'component-1', 'material-1'),
    );

    await sut.buildComposition('1234', [
      {
        componentId: 'component-1',
        materials: [{ materialId: 'material-1', weight: 150 }],
      },
    ]);

    expect(queryBus.executedQueries).toEqual([
      new GetStandardBomByMiCodeQuery('1234'),
    ]);
  });

  it('rejects a standard BOM MI code that does not resolve to an existing standard BOM', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.rejectWith(
      GetStandardBomByMiCodeQuery.name,
      EntityNotFound.withId(Identity.new()),
    );

    await expect(
      sut.buildComposition('unknown-mi-code', [
        {
          componentId: 'component-1',
          materials: [{ materialId: 'material-1', weight: 150 }],
        },
      ]),
    ).rejects.toBeInstanceOf(BomStandardBomNotFound);
  });

  it("rejects a componentId that isn't part of the standard BOM's current composition", async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      GetStandardBomByMiCodeQuery.name,
      standardBomWith(Identity.new().asString(), 'component-1', 'material-1'),
    );

    await expect(
      sut.buildComposition('1234', [
        {
          componentId: 'unknown-component',
          materials: [{ materialId: 'material-1', weight: 150 }],
        },
      ]),
    ).rejects.toBeInstanceOf(BomCompositionEntryNotFound);
  });

  it("rejects a materialId that isn't part of the referenced component's current materials", async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      GetStandardBomByMiCodeQuery.name,
      standardBomWith(Identity.new().asString(), 'component-1', 'material-1'),
    );

    await expect(
      sut.buildComposition('1234', [
        {
          componentId: 'component-1',
          materials: [{ materialId: 'unknown-material', weight: 150 }],
        },
      ]),
    ).rejects.toBeInstanceOf(BomCompositionEntryNotFound);
  });
});
