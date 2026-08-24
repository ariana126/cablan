import { Identity } from '@framework/domain';

import { MaterialDeleted } from './events/material-deleted.event';
import { MaterialRegistered } from './events/material-registered.event';
import { MaterialRenamed } from './events/material-renamed.event';
import { Material } from './material.aggregate';
import { MaterialName } from './value/material-name.vo';

function registerMaterial(): Material {
  return Material.register(MaterialName.fromString('Steel Rod'));
}

describe('Material', () => {
  it('registering a material sets its name', () => {
    const sut = registerMaterial();

    expect(sut.name().asString()).toBe('Steel Rod');
  });

  it('registering a material records a MaterialRegistered event', () => {
    const sut = registerMaterial();

    const events = sut.releaseEvents();

    expect(events).toEqual([
      new MaterialRegistered(sut.id.asString(), 'Steel Rod'),
    ]);
  });

  it('renaming a material changes its name and records a MaterialRenamed event', () => {
    const sut = registerMaterial();
    sut.releaseEvents();

    sut.rename(MaterialName.fromString('Aluminium Rod'));

    expect(sut.name().asString()).toBe('Aluminium Rod');
    expect(sut.releaseEvents()).toEqual([
      new MaterialRenamed(sut.id.asString(), 'Steel Rod', 'Aluminium Rod'),
    ]);
  });

  it('deleting a material records a MaterialDeleted event', () => {
    const sut = registerMaterial();
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new MaterialDeleted(sut.id.asString(), 'Steel Rod'),
    ]);
  });

  it('reconstructing a material from persistence records no event', () => {
    const id = Identity.new();

    const sut = Material.fromPersistence(
      id,
      MaterialName.fromString('Steel Rod'),
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.name().asString()).toBe('Steel Rod');
    expect(sut.releaseEvents()).toEqual([]);
  });
});
