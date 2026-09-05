import { FindComponentByNameQuery } from '@components/application/queries/find-component-by-name/find-component-by-name.query';
import { Identity } from '@framework/domain';
import { FindMaterialByNameQuery } from '@materials/application/queries/find-material-by-name/find-material-by-name.query';
import { QueryBus } from '@nestjs/cqrs';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { StubQueryBus } from '@products/application/support/stub-query-bus';
import { ProductName } from '@products/domain/value/product-name.vo';

import { RegisterProductCommand } from './register-product.command';
import { RegisterProductHandler } from './register-product.handler';

function makeSut() {
  const queryBus = new StubQueryBus();
  const productRepository = new InMemoryProductRepository();
  const compositionFactory = new ProductCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new RegisterProductHandler(productRepository, compositionFactory);
  return { sut, productRepository, queryBus };
}

describe('RegisterProductHandler', () => {
  it('registers a new product, resolving its component and material to already-registered rows', async () => {
    const { sut, productRepository, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-1',
      name: 'Bolt',
    });
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-1',
      name: 'Steel Rod',
    });

    const result = await sut.execute(
      new RegisterProductCommand(ProductName.fromString('Widget'), [
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    );

    expect(result.name).toBe('Widget');
    expect(result.components).toEqual([
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod' }],
      },
    ]);
    const saved = await productRepository.get(Identity.fromString(result.id));
    expect(saved.name().asString()).toBe('Widget');
  });

  it('rejects registering a product with no components', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), []),
      ),
    ).rejects.toBeInstanceOf(ProductMustHaveAtLeastOneComponent);
  });

  it('rejects registering a product whose component has no materials', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductComponentMustHaveAtLeastOneMaterial);
  });

  it('rejects registering a product with a component that is not already registered', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ComponentNotRegistered);
  });

  it('rejects registering a product with a material that is not already registered', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-1',
      name: 'Bolt',
    });

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
