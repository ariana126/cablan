import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { Component } from '@products/domain/component.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';

import { DeleteComponentCommand } from './delete-component.command';
import { DeleteComponentHandler } from './delete-component.handler';

describe('DeleteComponentHandler', () => {
  it('hard-deletes a component, and its name becomes free again', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new DeleteComponentHandler(
      componentRepository,
      new RecordDependencies([]),
    );
    const component = componentRepository.seed(
      Component.register(ComponentName.fromString('Bolt')),
    );

    await sut.execute(new DeleteComponentCommand(component.id));

    await expect(componentRepository.get(component.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
    expect(
      await componentRepository.findByName(ComponentName.fromString('Bolt')),
    ).toBeNull();
  });

  it('refuses deleting a component another record references, keeping it', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const component = componentRepository.seed(
      Component.register(ComponentName.fromString('Bolt')),
    );
    const probe = new StubDependentsProbe().given(
      { type: 'Component', id: component.id.asString() },
      [{ kind: 'standard-bom', name: 'MI-100' }],
    );
    const sut = new DeleteComponentHandler(
      componentRepository,
      new RecordDependencies([probe]),
    );

    await expect(
      sut.execute(new DeleteComponentCommand(component.id)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await componentRepository.find(component.id)).not.toBeNull();
  });

  it('rejects deleting a component that does not exist', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new DeleteComponentHandler(
      componentRepository,
      new RecordDependencies([]),
    );

    await expect(
      sut.execute(new DeleteComponentCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
