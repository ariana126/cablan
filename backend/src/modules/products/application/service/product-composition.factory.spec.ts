import { Identity } from '@framework/domain';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductCompositionEntryNotFound,
} from '@products/application/exceptions';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { Component } from '@products/domain/component.aggregate';
import { Material } from '@products/domain/material.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';

import { ProductCompositionFactory } from './product-composition.factory';

function makeSut() {
  const componentRepository = new InMemoryComponentRepository();
  const materialRepository = new InMemoryMaterialRepository();
  const sut = new ProductCompositionFactory(
    componentRepository,
    materialRepository,
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
  return { sut, materialRepository, registeredComponent, registeredMaterial };
}

describe('ProductCompositionFactory', () => {
  it('creates a component line carrying the id and name of an already-registered component and material', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const bolt = registeredComponent('Bolt');
    const steelRod = registeredMaterial('Steel Rod');

    const lines = await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe(bolt.id.asString());
    expect(lines[0].name()).toBe('Bolt');
    expect(lines[0].materials()).toHaveLength(1);
    expect(lines[0].materials()[0].materialId().asString()).toBe(
      steelRod.id.asString(),
    );
    expect(lines[0].materials()[0].name()).toBe('Steel Rod');
  });

  it('resolves every component and material listed to their own already-registered id', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const bolt = registeredComponent('Bolt');
    const nut = registeredComponent('Nut');
    const steelRod = registeredMaterial('Steel Rod');
    const copperWire = registeredMaterial('Copper Wire');

    const lines = await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
    ]);

    expect(lines.map((line) => line.componentId().asString())).toEqual([
      bolt.id.asString(),
      nut.id.asString(),
    ]);
    expect(
      lines.map((line) => line.materials()[0].materialId().asString()),
    ).toEqual([steelRod.id.asString(), copperWire.id.asString()]);
  });

  it('reuses the same material across two different components of one product, resolving it only once', async () => {
    const { sut, materialRepository, registeredComponent, registeredMaterial } =
      makeSut();
    registeredComponent('مغزی');
    registeredComponent('روکش');
    const copper = registeredMaterial('مسی');
    const findMaterialByName = jest.spyOn(materialRepository, 'findByName');

    const lines = await sut.createComponentLines([
      { name: 'مغزی', materials: [{ name: 'مسی' }] },
      { name: 'روکش', materials: [{ name: 'مسی' }] },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].materials()[0].materialId().asString()).toBe(
      copper.id.asString(),
    );
    expect(lines[1].materials()[0].materialId().asString()).toBe(
      copper.id.asString(),
    );
    expect(lines[1].materials()[0]).toEqual(lines[0].materials()[0]);
    expect(findMaterialByName).toHaveBeenCalledTimes(1);
    expect(findMaterialByName).toHaveBeenCalledWith(
      MaterialName.fromString('مسی'),
    );
  });

  it('still resolves materials that only share a name with a material of a different casing', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    registeredComponent('Core');
    registeredComponent('Sheath');
    const upperCase = registeredMaterial('Steel Rod');
    const lowerCase = registeredMaterial('steel rod');

    const lines = await sut.createComponentLines([
      { name: 'Core', materials: [{ name: 'Steel Rod' }] },
      { name: 'Sheath', materials: [{ name: 'steel rod' }] },
    ]);

    expect(lines[0].materials()[0].materialId().asString()).toBe(
      upperCase.id.asString(),
    );
    expect(lines[1].materials()[0].materialId().asString()).toBe(
      lowerCase.id.asString(),
    );
  });

  it('rejects registering a product with a component name that is not already registered', async () => {
    const { sut } = makeSut();

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toThrow(ComponentNotRegistered);
  });

  it('carries the attempted name on ComponentNotRegistered', async () => {
    const { sut } = makeSut();

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toMatchObject({ componentName: 'Bolt' });
  });

  it('rejects registering a product with a material name that is not already registered, once its component resolves', async () => {
    const { sut, registeredComponent } = makeSut();
    registeredComponent('Bolt');

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toThrow(MaterialNotRegistered);
  });

  it('carries the attempted name on MaterialNotRegistered', async () => {
    const { sut, registeredComponent } = makeSut();
    registeredComponent('Bolt');

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toMatchObject({ materialName: 'Steel Rod' });
  });
});

function existingComponentLine(): ProductComponentLine {
  return ProductComponentLine.of(Identity.new(), 'Bolt', [
    ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
  ]);
}

describe('ProductCompositionFactory.reconcileComponentLines', () => {
  it('reuses an existing component and material as-is when their ids are given, resolving nothing', async () => {
    // Nothing is registered, so resolving "Bolt" or "Steel Rod" by name would
    // throw: getting the lines back proves neither was resolved.
    const { sut } = makeSut();
    const existing = existingComponentLine();

    const lines = await sut.reconcileComponentLines(
      [existing],
      [
        {
          id: existing.componentId().asString(),
          name: existing.name(),
          materials: [
            {
              id: existing.materials()[0].materialId().asString(),
              name: existing.materials()[0].name(),
            },
          ],
        },
      ],
    );

    expect(lines).toEqual([existing]);
  });

  it('adds a new material to an existing component, resolving only the new material', async () => {
    // Only "Copper Wire" is registered: re-resolving the existing "Bolt" or
    // "Steel Rod" by name would throw.
    const { sut, registeredMaterial } = makeSut();
    const copperWire = registeredMaterial('Copper Wire');
    const existing = existingComponentLine();
    const existingMaterial = existing.materials()[0];

    const lines = await sut.reconcileComponentLines(
      [existing],
      [
        {
          id: existing.componentId().asString(),
          name: existing.name(),
          materials: [
            {
              id: existingMaterial.materialId().asString(),
              name: existingMaterial.name(),
            },
            { name: 'Copper Wire' },
          ],
        },
      ],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId()).toEqual(existing.componentId());
    expect(lines[0].materials()).toEqual([
      existingMaterial,
      ProductMaterialLine.of(copperWire.id, 'Copper Wire'),
    ]);
  });

  it('resolves a component with no id exactly like createComponentLines, by name', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const nut = registeredComponent('Nut');
    registeredMaterial('Copper Wire');

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe(nut.id.asString());
    expect(lines[0].name()).toBe('Nut');
  });

  it('reuses a globally existing component/material for a new (id-less) entry', async () => {
    const { sut, registeredComponent, registeredMaterial } = makeSut();
    const nut = registeredComponent('Nut');
    const copperWire = registeredMaterial('Copper Wire');

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe(nut.id.asString());
    expect(lines[0].materials()[0].materialId().asString()).toBe(
      copperWire.id.asString(),
    );
  });

  it('rejects a component id that is not part of the given current composition', async () => {
    const { sut } = makeSut();

    await expect(
      sut.reconcileComponentLines(
        [existingComponentLine()],
        [
          {
            id: Identity.new().asString(),
            name: 'Bolt',
            materials: [{ name: 'Steel Rod' }],
          },
        ],
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it("rejects a material id that is not part of the referenced component's current materials", async () => {
    const { sut } = makeSut();
    const existing = existingComponentLine();

    await expect(
      sut.reconcileComponentLines(
        [existing],
        [
          {
            id: existing.componentId().asString(),
            name: existing.name(),
            materials: [{ id: Identity.new().asString(), name: 'Steel Rod' }],
          },
        ],
      ),
    ).rejects.toBeInstanceOf(ProductCompositionEntryNotFound);
  });

  it('rejects editing a product with a new (id-less) component name that is not already registered', async () => {
    const { sut, registeredMaterial } = makeSut();
    registeredMaterial('Copper Wire');

    await expect(
      sut.reconcileComponentLines(
        [existingComponentLine()],
        [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
      ),
    ).rejects.toBeInstanceOf(ComponentNotRegistered);
  });

  it('rejects editing an existing component with a new (id-less) material name that is not already registered', async () => {
    const { sut } = makeSut();
    const existing = existingComponentLine();

    await expect(
      sut.reconcileComponentLines(
        [existing],
        [
          {
            id: existing.componentId().asString(),
            name: existing.name(),
            materials: [{ name: 'Copper Wire' }],
          },
        ],
      ),
    ).rejects.toBeInstanceOf(MaterialNotRegistered);
  });
});
