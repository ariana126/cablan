import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';
import { ComponentNameAlreadyExists } from '@products/application/exceptions';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { Component } from '@products/domain/component.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';

import { EditComponentCommand } from './edit-component.command';
import { EditComponentHandler } from './edit-component.handler';

function makeSut() {
  const componentRepository = new InMemoryComponentRepository();
  const probe = new StubDependentsProbe();
  const sut = new EditComponentHandler(
    componentRepository,
    new RecordDependencies([probe]),
  );
  return { sut, componentRepository, probe };
}

function seedComponent(
  componentRepository: InMemoryComponentRepository,
  name: string,
): Component {
  return componentRepository.seed(
    Component.register(ComponentName.fromString(name)),
  );
}

describe('EditComponentHandler', () => {
  it('renames a component', async () => {
    const { sut, componentRepository } = makeSut();
    const component = seedComponent(componentRepository, 'Bolt');

    await sut.execute(
      new EditComponentCommand(component.id, ComponentName.fromString('Nut')),
    );

    const saved = await componentRepository.get(component.id);
    expect(saved.name().asString()).toBe('Nut');
  });

  it('rejects renaming a component to a name already taken by another component', async () => {
    const { sut, componentRepository } = makeSut();
    seedComponent(componentRepository, 'Bolt');
    const other = seedComponent(componentRepository, 'Nut');

    await expect(
      sut.execute(
        new EditComponentCommand(other.id, ComponentName.fromString('Bolt')),
      ),
    ).rejects.toBeInstanceOf(ComponentNameAlreadyExists);
  });

  it('allows renaming a component to its own current name', async () => {
    const { sut, componentRepository } = makeSut();
    const component = seedComponent(componentRepository, 'Bolt');

    await sut.execute(
      new EditComponentCommand(component.id, ComponentName.fromString('Bolt')),
    );

    const saved = await componentRepository.get(component.id);
    expect(saved.name().asString()).toBe('Bolt');
  });

  it('refuses renaming a component another record references, leaving it unchanged', async () => {
    const { sut, componentRepository, probe } = makeSut();
    const component = seedComponent(componentRepository, 'Bolt');
    probe.given({ type: 'Component', id: component.id.asString() }, [
      { kind: 'product', name: 'کابل NYY' },
    ]);

    await expect(
      sut.execute(
        new EditComponentCommand(component.id, ComponentName.fromString('Nut')),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    const kept = await componentRepository.get(component.id);
    expect(kept.name().asString()).toBe('Bolt');
  });

  it('refuses even keeping the name of a component another record references', async () => {
    const { sut, componentRepository, probe } = makeSut();
    const component = seedComponent(componentRepository, 'Bolt');
    probe.given({ type: 'Component', id: component.id.asString() }, [
      { kind: 'daily-bom', name: 'ORD-1' },
    ]);

    await expect(
      sut.execute(
        new EditComponentCommand(
          component.id,
          ComponentName.fromString('Bolt'),
        ),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
  });

  it('rejects editing a component that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditComponentCommand(
          Identity.new(),
          ComponentName.fromString('Bolt'),
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
