import { FindComponentByNameQuery } from '@components/application/queries/find-component-by-name/find-component-by-name.query';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { Identity } from '@framework/domain';
import { FindMaterialByNameQuery } from '@materials/application/queries/find-material-by-name/find-material-by-name.query';
import { MaterialName } from '@materials/domain/value/material-name.vo';
import { QueryBus } from '@nestjs/cqrs';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductCompositionEntryNotFound,
} from '@products/application/exceptions';
import { StubQueryBus } from '@products/application/support/stub-query-bus';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';

import { ProductCompositionFactory } from './product-composition.factory';

function makeSut() {
  const queryBus = new StubQueryBus();
  const sut = new ProductCompositionFactory(queryBus as unknown as QueryBus);
  return { sut, queryBus };
}

describe('ProductCompositionFactory', () => {
  it('creates a component line carrying the id and name of an already-registered component and material', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-1',
      name: 'Bolt',
    });
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-1',
      name: 'Steel Rod',
    });

    const lines = await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe('component-1');
    expect(lines[0].name()).toBe('Bolt');
    expect(lines[0].materials()).toHaveLength(1);
    expect(lines[0].materials()[0].materialId().asString()).toBe('material-1');
    expect(lines[0].materials()[0].name()).toBe('Steel Rod');
  });

  it('resolves every component and material listed to their own already-registered id', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      FindComponentByNameQuery.name,
      { id: 'component-1', name: 'Bolt' },
      { id: 'component-2', name: 'Nut' },
    );
    queryBus.respondTo(
      FindMaterialByNameQuery.name,
      { id: 'material-1', name: 'Steel Rod' },
      { id: 'material-2', name: 'Copper Wire' },
    );

    const lines = await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
    ]);

    expect(lines.map((line) => line.componentId().asString())).toEqual([
      'component-1',
      'component-2',
    ]);
    expect(
      lines.map((line) => line.materials()[0].materialId().asString()),
    ).toEqual(['material-1', 'material-2']);
  });

  it('dispatches a FindComponentByNameQuery and a FindMaterialByNameQuery built from the given names', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-1',
      name: 'Bolt',
    });
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-1',
      name: 'Steel Rod',
    });

    await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
    ]);

    expect(queryBus.executedQueries).toEqual([
      new FindComponentByNameQuery(ComponentName.fromString('Bolt')),
      new FindMaterialByNameQuery(MaterialName.fromString('Steel Rod')),
    ]);
  });

  it('reuses the same material across two different components of one product, resolving it only once', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      FindComponentByNameQuery.name,
      { id: 'component-1', name: 'مغزی' },
      { id: 'component-2', name: 'روکش' },
    );
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-1',
      name: 'مسی',
    });

    const lines = await sut.createComponentLines([
      { name: 'مغزی', materials: [{ name: 'مسی' }] },
      { name: 'روکش', materials: [{ name: 'مسی' }] },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].materials()[0].materialId().asString()).toBe('material-1');
    expect(lines[1].materials()[0].materialId().asString()).toBe('material-1');
    expect(lines[1].materials()[0]).toEqual(lines[0].materials()[0]);
    expect(
      queryBus.executedQueries.filter(
        (query) => query.constructor.name === FindMaterialByNameQuery.name,
      ),
    ).toEqual([new FindMaterialByNameQuery(MaterialName.fromString('مسی'))]);
  });

  it('still resolves materials that only share a name with a material of a different casing', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(
      FindComponentByNameQuery.name,
      { id: 'component-1', name: 'Core' },
      { id: 'component-2', name: 'Sheath' },
    );
    queryBus.respondTo(
      FindMaterialByNameQuery.name,
      { id: 'material-1', name: 'Steel Rod' },
      { id: 'material-2', name: 'steel rod' },
    );

    const lines = await sut.createComponentLines([
      { name: 'Core', materials: [{ name: 'Steel Rod' }] },
      { name: 'Sheath', materials: [{ name: 'steel rod' }] },
    ]);

    expect(lines[0].materials()[0].materialId().asString()).toBe('material-1');
    expect(lines[1].materials()[0].materialId().asString()).toBe('material-2');
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
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-1',
      name: 'Bolt',
    });

    await expect(
      sut.createComponentLines([
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
      ]),
    ).rejects.toThrow(MaterialNotRegistered);
  });

  it('carries the attempted name on MaterialNotRegistered', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-1',
      name: 'Bolt',
    });

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
    const { sut, queryBus } = makeSut();
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
    expect(queryBus.executedQueries).toEqual([]);
  });

  it('adds a new material to an existing component, resolving only the new material', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-2',
      name: 'Copper Wire',
    });
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
      ProductMaterialLine.of(Identity.fromString('material-2'), 'Copper Wire'),
    ]);
    expect(queryBus.executedQueries).toEqual([
      new FindMaterialByNameQuery(MaterialName.fromString('Copper Wire')),
    ]);
  });

  it('resolves a component with no id exactly like createComponentLines, by name', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-2',
      name: 'Nut',
    });
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-2',
      name: 'Copper Wire',
    });

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe('component-2');
    expect(lines[0].name()).toBe('Nut');
  });

  it('reuses a globally existing component/material for a new (id-less) entry', async () => {
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindComponentByNameQuery.name, {
      id: 'component-2',
      name: 'Nut',
    });
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-2',
      name: 'Copper Wire',
    });

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe('component-2');
    expect(lines[0].materials()[0].materialId().asString()).toBe('material-2');
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
    const { sut, queryBus } = makeSut();
    queryBus.respondTo(FindMaterialByNameQuery.name, {
      id: 'material-2',
      name: 'Copper Wire',
    });

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
