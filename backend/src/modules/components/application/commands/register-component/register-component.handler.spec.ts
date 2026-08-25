import { ComponentNameAlreadyExists } from '@components/application/exceptions';
import { InMemoryComponentRepository } from '@components/application/support/in-memory-component-repository';
import { Component } from '@components/domain/component.aggregate';
import { ComponentName } from '@components/domain/value/component-name.vo';

import { RegisterComponentCommand } from './register-component.command';
import { RegisterComponentHandler } from './register-component.handler';

function makeSut() {
  const componentRepository = new InMemoryComponentRepository();
  const sut = new RegisterComponentHandler(componentRepository);
  return { sut, componentRepository };
}

describe('RegisterComponentHandler', () => {
  it('registers a new component', async () => {
    const { sut, componentRepository } = makeSut();

    const result = await sut.execute(
      new RegisterComponentCommand(ComponentName.fromString('Bolt')),
    );

    const saved = await componentRepository.findByName(
      ComponentName.fromString('Bolt'),
    );
    expect(saved?.name().asString()).toBe('Bolt');
    expect(result).toEqual({ id: saved?.id.asString() });
  });

  it('rejects registering a component name that is already taken', async () => {
    const { sut, componentRepository } = makeSut();
    componentRepository.seed(
      Component.register(ComponentName.fromString('Bolt')),
    );

    await expect(
      sut.execute(
        new RegisterComponentCommand(ComponentName.fromString('Bolt')),
      ),
    ).rejects.toBeInstanceOf(ComponentNameAlreadyExists);
  });
});
