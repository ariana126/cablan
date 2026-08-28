import { RegisterComponentCommand } from '@components/application/commands/register-component/register-component.command';
import { Identity } from '@framework/domain';
import { RegisterMaterialCommand } from '@materials/application/commands/register-material/register-material.command';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { StubCommandBus } from '@products/application/support/stub-command-bus';
import { StubQueryBus } from '@products/application/support/stub-query-bus';
import { ProductName } from '@products/domain/value/product-name.vo';

import { RegisterProductCommand } from './register-product.command';
import { RegisterProductHandler } from './register-product.handler';

function makeSut() {
  const commandBus = new StubCommandBus();
  commandBus.respondTo(RegisterComponentCommand.name, { id: 'component-1' });
  commandBus.respondTo(RegisterMaterialCommand.name, { id: 'material-1' });
  const queryBus = new StubQueryBus();
  const productRepository = new InMemoryProductRepository();
  const compositionFactory = new ProductCompositionFactory(
    commandBus as unknown as CommandBus,
    queryBus as unknown as QueryBus,
  );
  const sut = new RegisterProductHandler(productRepository, compositionFactory);
  return { sut, productRepository };
}

describe('RegisterProductHandler', () => {
  it('registers a new product, creating a new component and material for it', async () => {
    const { sut, productRepository } = makeSut();

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
});
