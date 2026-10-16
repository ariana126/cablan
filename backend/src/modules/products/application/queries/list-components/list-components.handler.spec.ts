import { InMemoryComponentRepository } from '@products/application/support/in-memory-component-repository';
import { Component } from '@products/domain/component.aggregate';
import { ComponentName } from '@products/domain/value/component-name.vo';

import { ListComponentsHandler } from './list-components.handler';

describe('ListComponentsHandler', () => {
  it('lists every registered component as a read model', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new ListComponentsHandler(componentRepository);
    componentRepository.seed(
      Component.register(ComponentName.fromString('Bolt')),
    );

    const result = await sut.execute();

    expect(result).toEqual([expect.objectContaining({ name: 'Bolt' })]);
  });

  it('lists no components when none are registered', async () => {
    const componentRepository = new InMemoryComponentRepository();
    const sut = new ListComponentsHandler(componentRepository);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
