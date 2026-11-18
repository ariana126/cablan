import {
  ApplyToRelatedRecords,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubCompositionOrderPropagator } from '@framework/application/support/stub-composition-order-propagator';
import { StubCorrectionPropagator } from '@framework/application/support/stub-correction-propagator';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity, Role } from '@framework/domain';
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

import { EditProductComponentInput } from '../product-component.input';
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
  const probe = new StubDependentsProbe();
  const propagator = new StubCorrectionPropagator();
  const orderPropagator = new StubCompositionOrderPropagator();
  const sut = new EditProductHandler(
    productRepository,
    compositionFactory,
    new RecordDependencies([probe], [propagator], [orderPropagator]),
    new ImmediateUnitOfWork(),
  );
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
  return {
    sut,
    productRepository,
    registeredComponent,
    registeredMaterial,
    probe,
    propagator,
    orderPropagator,
  };
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

function referenced() {
  const world = makeSut();
  const product = seedProduct(world.productRepository, 'Widget');
  world.probe.given({ type: 'Product', id: product.id.asString() }, [
    { kind: 'standard-bom', name: 'MI-100' },
  ]);
  return { ...world, product };
}

/** «کابل»: «هادی، عایق، روکش», referenced by a standard BOM (issue #122). */
function cableInUse() {
  const world = makeSut();
  const product = world.productRepository.seed(
    Product.register(ProductName.fromString('کابل'), [
      ProductComponentLine.of(Identity.new(), 'هادی', [
        ProductMaterialLine.of(Identity.new(), 'مس'),
      ]),
      ProductComponentLine.of(Identity.new(), 'عایق', [
        ProductMaterialLine.of(Identity.new(), 'PVC'),
      ]),
      ProductComponentLine.of(Identity.new(), 'روکش', [
        ProductMaterialLine.of(Identity.new(), 'PE'),
      ]),
    ]),
  );
  world.probe.given({ type: 'Product', id: product.id.asString() }, [
    { kind: 'standard-bom', name: 'MI-100' },
  ]);
  const [conductor, insulation, sheath] = product.components();
  return { ...world, product, conductor, insulation, sheath };
}

/** What a client resends for a line it keeps: the ids it was given. */
function resent(line: ProductComponentLine): EditProductComponentInput {
  return {
    id: line.componentId().asString(),
    name: line.name(),
    materials: line.materials().map((material) => ({
      id: material.materialId().asString(),
      name: material.name(),
    })),
  };
}

function namesOf(product: Product): string[] {
  return product.components().map((component) => component.name());
}

describe('EditProductHandler', () => {
  it('refuses renaming a product a standard BOM references, leaving it unchanged', async () => {
    const { sut, productRepository, probe } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    probe.given({ type: 'Product', id: product.id.asString() }, [
      { kind: 'standard-bom', name: 'MI-100' },
    ]);

    await expect(
      sut.execute(
        new EditProductCommand(product.id, ProductName.fromString('Gadget')),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    const kept = await productRepository.get(product.id);
    expect(kept.name().asString()).toBe('Widget');
  });

  it('refuses changing the composition of a product a standard BOM references', async () => {
    const {
      sut,
      productRepository,
      registeredComponent,
      registeredMaterial,
      probe,
    } = makeSut();
    const product = seedProduct(productRepository, 'Widget');
    const originalComponents = product.components();
    registeredComponent('Nut');
    registeredMaterial('Copper Wire');
    probe.given({ type: 'Product', id: product.id.asString() }, [
      { kind: 'standard-bom', name: 'MI-100' },
    ]);

    await expect(
      sut.execute(
        new EditProductCommand(product.id, undefined, [
          { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
        ]),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    const kept = await productRepository.get(product.id);
    expect(kept.components()).toEqual(originalComponents);
  });

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

  describe('the System Admin’s correction (issue #110)', () => {
    const admin = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);

    it('renames a product in use, carrying the name into its standard and daily BOMs', async () => {
      const { sut, productRepository, product, propagator } = referenced();

      await sut.execute(
        new EditProductCommand(
          product.id,
          ProductName.fromString('Gadget'),
          undefined,
          admin,
        ),
      );

      const reloaded = await productRepository.get(product.id);
      expect(reloaded.name().asString()).toBe('Gadget');
      expect(propagator.propagated).toEqual([
        {
          reference: { type: 'Product', id: product.id.asString() },
          correction: { name: 'Gadget' },
        },
      ]);
    });

    it('renames it while its unchanged composition is resent', async () => {
      const { sut, productRepository, product } = referenced();
      const [component] = product.components();
      const [material] = component.materials();
      const composition = product.components();

      await sut.execute(
        new EditProductCommand(
          product.id,
          ProductName.fromString('Gadget'),
          [
            {
              id: component.componentId().asString(),
              name: component.name(),
              materials: [
                { id: material.materialId().asString(), name: material.name() },
              ],
            },
          ],
          admin,
        ),
      );

      const saved = await productRepository.get(product.id);
      expect(saved.name().asString()).toBe('Gadget');
      expect(saved.components()).toEqual(composition);
    });

    it('still refuses an edit that also changes the composition', async () => {
      const {
        sut,
        productRepository,
        product,
        registeredComponent,
        registeredMaterial,
        propagator,
      } = referenced();
      registeredComponent('Nut');
      registeredMaterial('Copper Wire');

      await expect(
        sut.execute(
          new EditProductCommand(
            product.id,
            ProductName.fromString('Gadget'),
            [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      const reloaded = await productRepository.get(product.id);
      expect(reloaded.name().asString()).toBe('Widget');
      expect(propagator.propagated).toEqual([]);
    });

    it('is the ordinary refusal for anyone else who asks', async () => {
      const { sut, product } = referenced();

      await expect(
        sut.execute(
          new EditProductCommand(
            product.id,
            ProductName.fromString('Gadget'),
            undefined,
            ApplyToRelatedRecords.askedBy(Role.Management, true),
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
    });
  });

  // Issue #122: the order of a product's components may change while it is
  // in use — for Management and the System Admin alike — and nothing else.
  describe('reordering the components of a product in use (issue #122)', () => {
    it('lays them out in the new order, and carries it into the snapshots', async () => {
      const {
        sut,
        productRepository,
        orderPropagator,
        product,
        conductor,
        insulation,
        sheath,
      } = cableInUse();

      await sut.execute(
        new EditProductCommand(product.id, undefined, [
          resent(sheath),
          resent(conductor),
          resent(insulation),
        ]),
      );

      expect(namesOf(await productRepository.get(product.id))).toEqual([
        'روکش',
        'هادی',
        'عایق',
      ]);
      expect(orderPropagator.propagated).toEqual([
        {
          reference: { type: 'Product', id: product.id.asString() },
          orderedComponentIds: [
            sheath.componentId().asString(),
            conductor.componentId().asString(),
            insulation.componentId().asString(),
          ],
        },
      ]);
    });

    it('recognises it when the components are sent by name, without ids', async () => {
      const {
        sut,
        productRepository,
        registeredComponent,
        registeredMaterial,
        probe,
        orderPropagator,
      } = makeSut();
      const conductor = registeredComponent('هادی');
      const insulation = registeredComponent('عایق');
      const copper = registeredMaterial('مس');
      const pvc = registeredMaterial('PVC');
      const product = productRepository.seed(
        Product.register(ProductName.fromString('کابل'), [
          ProductComponentLine.of(conductor.id, 'هادی', [
            ProductMaterialLine.of(copper.id, 'مس'),
          ]),
          ProductComponentLine.of(insulation.id, 'عایق', [
            ProductMaterialLine.of(pvc.id, 'PVC'),
          ]),
        ]),
      );
      probe.given({ type: 'Product', id: product.id.asString() }, [
        { kind: 'standard-bom', name: 'MI-100' },
      ]);

      await sut.execute(
        new EditProductCommand(product.id, undefined, [
          { name: 'عایق', materials: [{ name: 'PVC' }] },
          { name: 'هادی', materials: [{ name: 'مس' }] },
        ]),
      );

      expect(namesOf(await productRepository.get(product.id))).toEqual([
        'عایق',
        'هادی',
      ]);
      expect(orderPropagator.propagated).toHaveLength(1);
    });

    it('allows it with its unchanged name resent', async () => {
      const { sut, productRepository, product, conductor, insulation, sheath } =
        cableInUse();

      await sut.execute(
        new EditProductCommand(product.id, ProductName.fromString('کابل'), [
          resent(insulation),
          resent(sheath),
          resent(conductor),
        ]),
      );

      expect(namesOf(await productRepository.get(product.id))).toEqual([
        'عایق',
        'روکش',
        'هادی',
      ]);
    });

    it('refuses a reordering that also adds a component, changing nothing', async () => {
      const {
        sut,
        productRepository,
        registeredComponent,
        registeredMaterial,
        orderPropagator,
        product,
        conductor,
        insulation,
        sheath,
      } = cableInUse();
      registeredComponent('زره');
      registeredMaterial('فولاد');

      await expect(
        sut.execute(
          new EditProductCommand(product.id, undefined, [
            resent(sheath),
            resent(conductor),
            resent(insulation),
            { name: 'زره', materials: [{ name: 'فولاد' }] },
          ]),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(namesOf(await productRepository.get(product.id))).toEqual([
        'هادی',
        'عایق',
        'روکش',
      ]);
      expect(orderPropagator.propagated).toEqual([]);
    });

    it('refuses a reordering that also renames it, without a correction', async () => {
      const { sut, productRepository, product, conductor, insulation, sheath } =
        cableInUse();

      await expect(
        sut.execute(
          new EditProductCommand(
            product.id,
            ProductName.fromString('کابل NYY'),
            [resent(sheath), resent(conductor), resent(insulation)],
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(namesOf(await productRepository.get(product.id))).toEqual([
        'هادی',
        'عایق',
        'روکش',
      ]);
    });

    it('is still refused before a composition that cannot be resolved is', async () => {
      const { sut, product, conductor, insulation, sheath } = cableInUse();

      await expect(
        sut.execute(
          new EditProductCommand(product.id, undefined, [
            resent(sheath),
            resent(conductor),
            resent(insulation),
            { name: 'ثبت نشده', materials: [{ name: 'ثبت نشده' }] },
          ]),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
    });

    it('rides along with the System Admin’s correction of its name', async () => {
      const {
        sut,
        productRepository,
        propagator,
        orderPropagator,
        product,
        conductor,
        insulation,
        sheath,
      } = cableInUse();

      await sut.execute(
        new EditProductCommand(
          product.id,
          ProductName.fromString('کابل NYY'),
          [resent(sheath), resent(conductor), resent(insulation)],
          ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true),
        ),
      );

      const saved = await productRepository.get(product.id);
      expect(saved.name().asString()).toBe('کابل NYY');
      expect(namesOf(saved)).toEqual(['روکش', 'هادی', 'عایق']);
      expect(propagator.propagated).toHaveLength(1);
      expect(orderPropagator.propagated).toHaveLength(1);
    });
  });
});
