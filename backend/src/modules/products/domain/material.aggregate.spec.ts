import { Identity } from '@framework/domain';

import { MaterialDeleted } from './events/material-deleted.event';
import { MaterialEdited } from './events/material-edited.event';
import { MaterialRegistered } from './events/material-registered.event';
import { MaterialRegisteredByImport } from './events/material-registered-by-import.event';
import { MaterialRestoredBeforeImport } from './events/material-restored-before-import.event';
import { MaterialRevisedByImport } from './events/material-revised-by-import.event';
import { MaterialWithdrawnByImport } from './events/material-withdrawn-by-import.event';
import { Material } from './material.aggregate';
import { MaterialCode } from './value/material-code.vo';
import { MaterialName } from './value/material-name.vo';

function registerMaterial(code = 'RM-001'): Material {
  return Material.register(
    MaterialName.fromString('Steel Rod'),
    MaterialCode.fromString(code),
  );
}

function registeredMaterial(code = 'RM-001'): Material {
  const material = registerMaterial(code);
  material.releaseEvents();
  return material;
}

describe('Material', () => {
  it('registering a material sets its name and code', () => {
    const sut = registerMaterial('RM-001');

    expect(sut.name().asString()).toBe('Steel Rod');
    expect(sut.code().asString()).toBe('RM-001');
  });

  it('registering a material records a MaterialRegistered event carrying its name and code', () => {
    const sut = registerMaterial('RM-001');

    const events = sut.releaseEvents();

    expect(events).toEqual([
      new MaterialRegistered(sut.id.asString(), 'Steel Rod', 'RM-001'),
    ]);
  });

  it('renaming a material records one MaterialEdited event with a name change', () => {
    const sut = registeredMaterial();

    sut.edit({
      name: MaterialName.fromString('Aluminium Rod'),
      code: MaterialCode.fromString('RM-001'),
    });

    expect(sut.name().asString()).toBe('Aluminium Rod');
    expect(sut.releaseEvents()).toEqual([
      new MaterialEdited(sut.id.asString(), [
        {
          field: 'name',
          previousValue: 'Steel Rod',
          newValue: 'Aluminium Rod',
        },
      ]),
    ]);
  });

  it("changing a material's code records one MaterialEdited event with a code change", () => {
    const sut = registeredMaterial('RM-001');

    sut.edit({
      name: MaterialName.fromString('Steel Rod'),
      code: MaterialCode.fromString('RM-002'),
    });

    expect(sut.code().asString()).toBe('RM-002');
    expect(sut.releaseEvents()).toEqual([
      new MaterialEdited(sut.id.asString(), [
        { field: 'code', previousValue: 'RM-001', newValue: 'RM-002' },
      ]),
    ]);
  });

  it('changing both name and code in one edit records a single event with both changes', () => {
    const sut = registeredMaterial('RM-001');

    sut.edit({
      name: MaterialName.fromString('Aluminium Rod'),
      code: MaterialCode.fromString('RM-002'),
    });

    expect(sut.releaseEvents()).toEqual([
      new MaterialEdited(sut.id.asString(), [
        {
          field: 'name',
          previousValue: 'Steel Rod',
          newValue: 'Aluminium Rod',
        },
        { field: 'code', previousValue: 'RM-001', newValue: 'RM-002' },
      ]),
    ]);
  });

  it('an edit resending the current name and changing the code records only the code change', () => {
    const sut = registeredMaterial('RM-001');

    sut.edit({
      name: MaterialName.fromString('Steel Rod'),
      code: MaterialCode.fromString('RM-002'),
    });

    expect(sut.releaseEvents()).toEqual([
      new MaterialEdited(sut.id.asString(), [
        { field: 'code', previousValue: 'RM-001', newValue: 'RM-002' },
      ]),
    ]);
  });

  it('an edit that changes nothing records no event', () => {
    const sut = registeredMaterial('RM-001');

    sut.edit({
      name: MaterialName.fromString('Steel Rod'),
      code: MaterialCode.fromString('RM-001'),
    });

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('deleting a material records a MaterialDeleted event carrying its name and code', () => {
    const sut = registeredMaterial('RM-001');

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new MaterialDeleted(sut.id.asString(), 'Steel Rod', 'RM-001'),
    ]);
  });

  it('reconstructing a material from persistence records no event', () => {
    const id = Identity.new();

    const sut = Material.fromPersistence(
      id,
      MaterialName.fromString('Steel Rod'),
      MaterialCode.fromString('RM-001'),
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.name().asString()).toBe('Steel Rod');
    expect(sut.code().asString()).toBe('RM-001');
    expect(sut.releaseEvents()).toEqual([]);
  });

  it('a material registered by an import records only a MaterialRegisteredByImport event', () => {
    const sut = Material.registerByImport(
      MaterialName.fromString('Steel Rod'),
      MaterialCode.fromString('RM-001'),
    );

    expect(sut.name().asString()).toBe('Steel Rod');
    expect(sut.releaseEvents()).toEqual([
      new MaterialRegisteredByImport(sut.id.asString(), 'Steel Rod', 'RM-001'),
    ]);
  });

  it('a material revised by an import records only a MaterialRevisedByImport event', () => {
    const sut = registeredMaterial('RM-001');

    sut.reviseByImport(
      MaterialName.fromString('Aluminium Rod'),
      MaterialCode.fromString('RM-002'),
    );

    expect([sut.name().asString(), sut.code().asString()]).toEqual([
      'Aluminium Rod',
      'RM-002',
    ]);
    expect(sut.releaseEvents()).toEqual([
      new MaterialRevisedByImport(
        sut.id.asString(),
        'Steel Rod',
        'RM-001',
        'Aluminium Rod',
        'RM-002',
      ),
    ]);
  });

  it('a material restored while reverting an import records only a MaterialRestoredBeforeImport event', () => {
    const sut = registeredMaterial('RM-002');

    sut.restoreBeforeImport(
      MaterialName.fromString('Steel Rod'),
      MaterialCode.fromString('RM-001'),
    );

    expect(sut.code().asString()).toBe('RM-001');
    expect(sut.releaseEvents()).toEqual([
      new MaterialRestoredBeforeImport(
        sut.id.asString(),
        'Steel Rod',
        'RM-002',
        'Steel Rod',
        'RM-001',
      ),
    ]);
  });

  it('a material withdrawn while reverting an import records only a MaterialWithdrawnByImport event', () => {
    const sut = registeredMaterial('RM-001');

    sut.withdrawFromImport();

    expect(sut.releaseEvents()).toEqual([
      new MaterialWithdrawnByImport(sut.id.asString(), 'Steel Rod', 'RM-001'),
    ]);
  });
});
