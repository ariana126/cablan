import { EntityNotFound, Identity } from '@framework/domain';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { Product } from '@products/domain/product.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { EditProductCommand } from './edit-product.command';
import { EditProductHandler } from './edit-product.handler';

function makeSut() {
  const productRepository = new InMemoryProductRepository();
  const componentRepository = new InMemoryComponentRepository();
  const materialRepository = new InMemoryMaterialRepository();
  const compositionFactory = new ProductCompositionFactory(
    componentRepository,
    materialRepository,
  );
  const sut = new EditProductHandler(productRepository, compositionFactory);
  const registeredComponent = (name: string): Component =>
    componentRepository.seed(
      Component.register(ComponentName.fromString(name)),
    );
  const registeredMaterial = (name: string): Material =>
    materialRepository.seed(
      Material.register(
        MaterialName.fromString(name),
        MaterialCode.fromString(`RM-${name}`),
      ),
    );
  return { sut, productRepository, registeredComponent, registeredMaterial };
}

// The seeded product's "Bolt"/"Steel Rod" lines carry fresh ids that are not
// registered as a `Component`/`Material`, so any attempt to re-resolve them by
// name throws ComponentNotRegistered/MaterialNotRegistered.
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
    const { sut, productRepository, registeredComponent, registeredMaterial } =
      makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const nut = registeredComponent('Nut');
    registeredMaterial('Copper Wire');

    await sut.execute(
      new EditProductCommand(product.id, undefined, [
        { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
      ]),
    );

    const saved = await productRepository.get(product.id);
    expect(saved.name().asString()).toBe('Widget');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe(
      nut.id.asString(),
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
    // Nothing is registered: succeeding proves no name was resolved.
    const { sut, productRepository } = makeSut();
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
  });

  it('adds a new material to an existing component referenced by id, resolving only the new material', async () => {
    const { sut, productRepository, registeredMaterial } = makeSut();
    const copperWire = registeredMaterial('Copper Wire');
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
      copperWire.id.asString(),
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
    const { sut, productRepository, registeredMaterial } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    registeredMaterial('Copper Wire');

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
