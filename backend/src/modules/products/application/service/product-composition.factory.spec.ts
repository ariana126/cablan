import { RegisterComponentCommand } from '@components/application/commands/register-component/register-component.command';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { Identity } from '@framework/domain';
import { RegisterMaterialCommand } from '@materials/application/commands/register-material/register-material.command';
import { MaterialName } from '@materials/domain/value/material-name.vo';
import { CommandBus } from '@nestjs/cqrs';
import { ProductCompositionEntryNotFound } from '@products/application/exceptions';
import { StubCommandBus } from '@products/application/support/stub-command-bus';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';

import { ProductCompositionFactory } from './product-composition.factory';

function makeSut() {
  const commandBus = new StubCommandBus();
  const sut = new ProductCompositionFactory(
    commandBus as unknown as CommandBus,
  );
  return { sut, commandBus };
}

describe('ProductCompositionFactory', () => {
  it('creates a component line carrying the id and name of the newly registered component and material', async () => {
    const { sut, commandBus } = makeSut();
    commandBus.respondTo(RegisterComponentCommand.name, { id: 'component-1' });
    commandBus.respondTo(RegisterMaterialCommand.name, { id: 'material-1' });

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

  it('registers every component and material listed, each with a fresh id', async () => {
    const { sut, commandBus } = makeSut();
    commandBus.respondTo(
      RegisterComponentCommand.name,
      { id: 'component-1' },
      { id: 'component-2' },
    );
    commandBus.respondTo(
      RegisterMaterialCommand.name,
      { id: 'material-1' },
      { id: 'material-2' },
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

  it('dispatches a RegisterComponentCommand and a RegisterMaterialCommand built from the given names', async () => {
    const { sut, commandBus } = makeSut();
    commandBus.respondTo(RegisterComponentCommand.name, { id: 'component-1' });
    commandBus.respondTo(RegisterMaterialCommand.name, { id: 'material-1' });

    await sut.createComponentLines([
      { name: 'Bolt', materials: [{ name: 'Steel Rod' }] },
    ]);

    expect(commandBus.executedCommands).toEqual([
      new RegisterComponentCommand(ComponentName.fromString('Bolt')),
      new RegisterMaterialCommand(MaterialName.fromString('Steel Rod')),
    ]);
  });
});

function existingComponentLine(): ProductComponentLine {
  return ProductComponentLine.of(Identity.new(), 'Bolt', [
    ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
  ]);
}

describe('ProductCompositionFactory.reconcileComponentLines', () => {
  it('reuses an existing component and material as-is when their ids are given, registering nothing', async () => {
    const { sut, commandBus } = makeSut();
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
    expect(commandBus.executedCommands).toEqual([]);
  });

  it('adds a new material to an existing component, registering only the new material', async () => {
    const { sut, commandBus } = makeSut();
    commandBus.respondTo(RegisterMaterialCommand.name, { id: 'material-2' });
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
    expect(commandBus.executedCommands).toEqual([
      new RegisterMaterialCommand(MaterialName.fromString('Copper Wire')),
    ]);
  });

  it('registers a component with no id as brand new, exactly like createComponentLines', async () => {
    const { sut, commandBus } = makeSut();
    commandBus.respondTo(RegisterComponentCommand.name, { id: 'component-2' });
    commandBus.respondTo(RegisterMaterialCommand.name, { id: 'material-2' });

    const lines = await sut.reconcileComponentLines(
      [existingComponentLine()],
      [{ name: 'Nut', materials: [{ name: 'Copper Wire' }] }],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].componentId().asString()).toBe('component-2');
    expect(lines[0].name()).toBe('Nut');
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
});
