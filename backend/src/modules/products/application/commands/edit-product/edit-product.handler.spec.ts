import { FindComponentByNameQuery } from '@components/application/queries/find-component-by-name/find-component-by-name.query';
import { EntityNotFound, Identity } from '@framework/domain';
import { FindMaterialByNameQuery } from '@materials/application/queries/find-material-by-name/find-material-by-name.query';
import { QueryBus } from '@nestjs/cqrs';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { StubQueryBus } from '@products/application/support/stub-query-bus';
import { Product } from '@products/domain/product.aggregate';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { EditProductCommand } from './edit-product.command';
import { EditProductHandler } from './edit-product.handler';

function makeSut() {
  const queryBus = new StubQueryBus();
  const productRepository = new InMemoryProductRepository();
  const compositionFactory = new ProductCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new EditProductHandler(productRepository, compositionFactory);
  return { sut, productRepository, queryBus };
}

function seedProduct(
  productRepository: InMemoryProductRepository,
  name: string,
): Product {
  return productRepository.seed(
    Product.register(ProductName.fromString(name), [
      ProductComponentLine.of(Identity.new(), 'Bolt', [
        ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
      ]),
    ]),
  );
}

describe('EditProductHandler', () => {
  it('renames a product, leaving its components untouched', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const originalComponents = product.components();

    await sut.execute(
      new EditProductCommand(product.id, ProductName.fromString('Gadget')),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Gadget');
    expect(saved.components()).toEqual(originalComponents);
  });

  it("replaces a product's components with newly resolved ones, leaving its name untouched", async () => {
    const { sut, productRepository, queryBus } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'new-component',
      name: 'Nut',
    });
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'new-material',
      name: 'Copper Wire',
    });

    await sut.execute(
      new EditProductCommand(product.id, undefined, [
        { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Widget');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe(
      'new-component',
    );
    expect(saved.components()[0].name()).toBe('Nut');
  });

  it('rejects editing a product to have no components', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');

    await expect(
      sut.execute(new EditProductCommand(product.id, undefined, [])),
    ).rejects.toBeInstanceOf(ProductMustHaveAtLeastOneComponent);
  });

  it('rejects editing a product so that a component has no materials', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          { name: 'Nut', materials: [] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductComponentMustHaveAtLeastOneMaterial);
  });

  it('rejects editing a product that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditProductCommand(
          Identity.new(),
          ProductName.fromString('Widget'),
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('renames a product while resending its unchanged component and material by id, resolving nothing new', async () => {
    const { sut, productRepository, queryBus } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];
    const existingMaterial = existingComponent.materials()[0];

    await sut.execute(
      new EditProductCommand(product.id, ProductName.fromString('Gadget'), [
        {
          id: existingComponent.componentId().asString(),
          name: existingComponent.name(),
          materials: [
            {
              id: existingMaterial.materialId().asString(),
              name: existingMaterial.name(),
            },
          ],
        },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Gadget');
    expect(saved.components()).toEqual([existingComponent]);
    expect(queryBus.executedQueries).toEqual([]);
  });

  it('adds a new material to an existing component referenced by id, resolving only the new material', async () => {
    const { sut, productRepository, queryBus } = makeSut();
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-2',
      name: 'Copper Wire',
    });
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];
    const existingMaterial = existingComponent.materials()[0];

    await sut.execute(
      new EditProductCommand(product.id, undefined, [
        {
          id: existingComponent.componentId().asString(),
          name: existingComponent.name(),
          materials: [
            {
              id: existingMaterial.materialId().asString(),
              name: existingMaterial.name(),
            },
            { name: 'Copper Wire' },
          ],
        },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId()).toEqual(
      existingComponent.componentId(),
    );
    expect(saved.components()[0].materials()).toHaveLength(2);
    expect(saved.components()[0].materials()[0]).toEqual(existingMaterial);
    expect(saved.components()[0].materials()[1].name()).toBe('Copper Wire');
    expect(saved.components()[0].materials()[1].materialId().asString()).toBe(
      'material-2',
    );
  });

  it("rejects a component id that isn't part of this product's current composition", async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          {
            id: Identity.new().asString(),
            name: 'Bolt',
            materials: [{ name: 'Steel Rod' }],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it("rejects a material id that isn't part of the referenced component's current materials", async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          {
            id: existingComponent.componentId().asString(),
            name: existingComponent.name(),
            materials: [{ id: Identity.new().asString(), name: 'Steel Rod' }],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it('rejects editing a product with a new (id-less) component that is not already registered', async () => {
    const { sut, productRepository, queryBus } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-2',
      name: 'Copper Wire',
    });

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(ComponentNotRegistered);
  });

  it('rejects adding a new (id-less) material to an existing component that is not already registered', async () => {
    const { sut, productRepository } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const existingComponent = product.components()[0];
    const existingMaterial = existingComponent.materials()[0];

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          {
            id: existingComponent.componentId().asString(),
            name: existingComponent.name(),
            materials: [
              {
                id: existingMaterial.materialId().asString(),
                name: existingMaterial.name(),
              },
              { name: 'Copper Wire' },
            ],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
