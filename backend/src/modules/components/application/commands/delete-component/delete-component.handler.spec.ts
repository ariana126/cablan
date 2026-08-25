import { InMemoryComponentRepository } from '@components/application/support/in-memory-component-repository';
import { Component } from '@components/domain/component.aggregate';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { DeleteComponentCommand } from './delete-component.command';
import { DeleteComponentHandler } from './delete-component.handler';

describe('DeleteComponentHandler', () => {
  it('hard-deletes a component, and its name becomes free again', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new DeleteComponentHandler(componentRepository);
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

  it('rejects deleting a component that does not exist', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new DeleteComponentHandler(componentRepository);

    await expect(
      sut.execute(new DeleteComponentCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
