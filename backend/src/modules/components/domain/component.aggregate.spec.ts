import { Identity } from '@framework/domain';

import { Component } from './component.aggregate';
import { ComponentDeleted } from './events/component-deleted.event';
import { ComponentRegistered } from './events/component-registered.event';
import { ComponentRenamed } from './events/component-renamed.event';
import { ComponentName } from './value/component-name.vo';

function registerComponent(): Component {
  return Component.register(ComponentName.fromString('Bolt'));
}

describe('Component', () => {
  it('registering a component sets its name', () => {
    const sut = registerComponent();

    expect(sut.name().asString()).toBe('Bolt');
  });

  it('registering a component records a ComponentRegistered event', () => {
    const sut = registerComponent();

    const events = sut.releaseEvents();

    expect(events).toEqual([
      new ComponentRegistered(sut.id.asString(), 'Bolt'),
    ]);
  });

  it('renaming a component changes its name and records a ComponentRenamed event', () => {
    const sut = registerComponent();
    sut.releaseEvents();

    sut.rename(ComponentName.fromString('Nut'));

    expect(sut.name().asString()).toBe('Nut');
    expect(sut.releaseEvents()).toEqual([
      new ComponentRenamed(sut.id.asString(), 'Bolt', 'Nut'),
    ]);
  });

  it('deleting a component records a ComponentDeleted event', () => {
    const sut = registerComponent();
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new ComponentDeleted(sut.id.asString(), 'Bolt'),
    ]);
  });

  it('reconstructing a component from persistence records no event', () => {
    const id = Identity.new();

    const sut = Component.fromPersistence(id, ComponentName.fromString('Bolt'));

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.name().asString()).toBe('Bolt');
    expect(sut.releaseEvents()).toEqual([]);
  });
});
