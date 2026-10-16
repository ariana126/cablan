import { Identity } from '@framework/domain';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { RegisterProductCommand } from './register-product.command';
import { RegisterProductHandler } from './register-product.handler';

function makeSut() {
  const productRepository = new InMemoryProductRepository();
  const componentRepository = new InMemoryComponentRepository();
  const materialRepository = new InMemoryMaterialRepository();
  const compositionFactory = new ProductCompositionFactory(
    componentRepository,
    materialRepository,
  );
  const sut = new RegisterProductHandler(productRepository, compositionFactory);
  const registeredComponent = (name: string): Component =>
    componentRepository.seed(
      Component.register(ComponentName.fromString(name)),
    );
  const registeredMaterial = (name: string): Material =>
    materialRepository.seed(
      Material.register(MaterialName.fromString(name), null),
    );
  return { sut, productRepository, registeredComponent, registeredMaterial };
}

describe('RegisterProductHandler', () => {
  it('registers a new product, resolving its component and material to already-registered rows', async () => {
    const { sut, productRepository, registeredComponent, registeredMaterial } =
      makeSut();
    const bolt = registeredComponent('Bolt');
    const steelRod = registeredMaterial('Steel Rod');

    const result = await sut.execute(
      new RegisterProductCommand(ProductName.fromString('Widget'), [
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    );

    expect(result.name).toBe('Widget');
    expect(result.components).toEqual([
      {
        id: bolt.id.asString(),
        name: 'Bolt',
        materials: [{ id: steelRod.id.asString(), name: 'Steel Rod' }],
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
    const { sut, registeredComponent } = makeSut();
    registeredComponent('Bolt');

    await expect(
      sut.execute(
        new RegisterProductCommand(ProductName.fromString('Widget'), [
          { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
