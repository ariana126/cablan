import { InMemoryComponentRepository } from '@components/application/support/in-memory-component-repository';
import { Component } from '@components/domain/component.aggregate';
import { ComponentName } from '@components/domain/value/component-name.vo';

import { FindComponentByNameHandler } from './find-component-by-name.handler';
import { FindComponentByNameQuery } from './find-component-by-name.query';

describe('FindComponentByNameHandler', () => {
  it('finds the id and name of a component already registered under that name', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new FindComponentByNameHandler(componentRepository);
    const component = componentRepository.seed(
      Component.register(ComponentName.fromString('Bolt')),
    );

    const result = await sut.execute(
      new FindComponentByNameQuery(ComponentName.fromString('Bolt')),
    );

    expect(result).toEqual({
      id: component.id.asString(),
      name: 'Bolt',
    });
  });

  it('finds nothing when no component is registered under that name', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new FindComponentByNameHandler(componentRepository);

    const result = await sut.execute(
      new FindComponentByNameQuery(ComponentName.fromString('Bolt')),
    );

    expect(result).toBeUndefined();
  });
});
