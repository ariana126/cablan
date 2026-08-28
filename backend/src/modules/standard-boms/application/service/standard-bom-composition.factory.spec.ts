import { EntityNotFound, Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import {
  StandardBomCompositionEntryNotFound,
  StandardBomProductNotFound,
} from '@standard-boms/application/exceptions';
import { StubQueryBus } from '@standard-boms/application/support/stub-query-bus';

import { StandardBomCompositionFactory } from './standard-bom-composition.factory';

function makeSut() {
  const queryBus = new StubQueryBus();
  const sut = new StandardBomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  return { sut, queryBus };
}

function productWith(
  componentId: string,
  materialId: string,
): ProductReadModel {
  return new ProductReadModel('product-1', 'Widget', [
    {
      id: componentId,
      name: 'Bolt',
      materials: [{ id: materialId, name: 'Steel Rod' }],
    },
  ]);
}

describe('StandardBomCompositionFactory', () => {
  it("clones the referenced component and material's id and name, attaching the given weight", async () => {
    const { sut, queryBus } = makeSut();
    const productId = Identity.new();
    queryBus.respondTo(
      GetProductQuery.name,
      productWith('component-1', 'material-1'),
    );

    const { productName, componentLines } = await sut.buildComponentLines(
      productId,
      [
        {
          componentId: 'component-1',
          materials: [{ materialId: 'material-1', weight: 150 }],
        },
      ],
    );

    expect(productName).toBe('Widget');
    expect(componentLines).toHaveLength(1);
    expect(componentLines[0].componentId().asString()).toBe('component-1');
    expect(componentLines[0].name()).toBe('Bolt');
    expect(componentLines[0].materials()).toHaveLength(1);
    expect(componentLines[0].materials()[0].materialId().asString()).toBe(
      'material-1',
    );
    expect(componentLines[0].materials()[0].name()).toBe('Steel Rod');
    expect(componentLines[0].materials()[0].weight().asGrams()).toBe(150);
  });

  it('dispatches a GetProductQuery for the given product id', async () => {
    const { sut, queryBus } = makeSut();
    const productId = Identity.new();
    queryBus.respondTo(
      GetProductQuery.name,
      productWith('component-1', 'material-1'),
    );

    await sut.buildComponentLines(productId, [
      {
        componentId: 'component-1',
        materials: [{ materialId: 'material-1', weight: 150 }],
      },
    ]);

    expect(queryBus.executedQueries).toEqual([new GetProductQuery(productId)]);
  });

  it('rejects a productId that does not resolve to an existing product', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.rejectWith(
      GetProductQuery.name,
      EntityNotFound.withId(Identity.new()),
    );

    await expect(
      sut.buildComponentLines(Identity.new(), [
        {
          componentId: 'component-1',
          materials: [{ materialId: 'material-1', weight: 150 }],
        },
      ]),
    ).rejects.toBeInstanceOf(StandardBomProductNotFound);
  });

  it("rejects a componentId that isn't part of the product's current composition", async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      GetProductQuery.name,
      productWith('component-1', 'material-1'),
    );

    await expect(
      sut.buildComponentLines(Identity.new(), [
        {
          componentId: 'unknown-component',
          materials: [{ materialId: 'material-1', weight: 150 }],
        },
      ]),
    ).rejects.toBeInstanceOf(StandardBomCompositionEntryNotFound);
  });

  it("rejects a materialId that isn't part of the referenced component's current materials", async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      GetProductQuery.name,
      productWith('component-1', 'material-1'),
    );

    await expect(
      sut.buildComponentLines(Identity.new(), [
        {
          componentId: 'component-1',
          materials: [{ materialId: 'unknown-material', weight: 150 }],
        },
      ]),
    ).rejects.toBeInstanceOf(StandardBomCompositionEntryNotFound);
  });
});
