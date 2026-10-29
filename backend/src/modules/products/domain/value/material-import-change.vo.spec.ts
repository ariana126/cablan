import { Identity } from '@framework/domain';

import {
  isMaterialImportChangeKind,
  MaterialImportChange,
} from './material-import-change.vo';

describe('MaterialImportChange', () => {
  it('a registration has nothing to restore', () => {
    const materialId = Identity.new();

    const sut = MaterialImportChange.registration(
      materialId,
      'آلومینیوم',
      'A-1',
    );

    expect(sut.snapshot()).toEqual({
      kind: 'register',
      materialId: materialId.asString(),
      previousName: null,
      previousCode: null,
      name: 'آلومینیوم',
      code: 'A-1',
    });
  });

  it('a code change keeps the name and remembers the old code', () => {
    const materialId = Identity.new();

    const sut = MaterialImportChange.codeChange(
      materialId,
      'مسی',
      'M-101',
      'M-201',
    );

    expect(sut.snapshot()).toEqual({
      kind: 'changeCode',
      materialId: materialId.asString(),
      previousName: 'مسی',
      previousCode: 'M-101',
      name: 'مسی',
      code: 'M-201',
    });
  });

  it('a rename keeps the code and remembers the old name', () => {
    const materialId = Identity.new();

    const sut = MaterialImportChange.rename(
      materialId,
      'B-1',
      'برنج',
      'برنج زرد',
    );

    expect(sut.snapshot()).toEqual({
      kind: 'rename',
      materialId: materialId.asString(),
      previousName: 'برنج',
      previousCode: 'B-1',
      name: 'برنج زرد',
      code: 'B-1',
    });
  });

  it('a stored change rebuilds to the change it was', () => {
    const materialId = Identity.new();
    const original = MaterialImportChange.rename(
      materialId,
      'B-1',
      'برنج',
      'برنج زرد',
    );

    const sut = MaterialImportChange.fromPersistence(
      'rename',
      materialId,
      'برنج',
      'B-1',
      'برنج زرد',
      'B-1',
    );

    expect(sut.equals(original)).toBe(true);
  });

  it('a stored change of an unknown kind is refused', () => {
    expect(() =>
      MaterialImportChange.fromPersistence(
        'delete',
        Identity.new(),
        null,
        null,
        'x',
        'y',
      ),
    ).toThrow('Unknown material import change kind');
  });

  it('a stored registration with a previous value is refused', () => {
    expect(() =>
      MaterialImportChange.fromPersistence(
        'register',
        Identity.new(),
        'قبلی',
        null,
        'آلومینیوم',
        'A-1',
      ),
    ).toThrow('does not match its kind');
  });

  it('a stored code change whose name changed is refused', () => {
    expect(() =>
      MaterialImportChange.fromPersistence(
        'changeCode',
        Identity.new(),
        'مس',
        'M-101',
        'مسی',
        'M-201',
      ),
    ).toThrow('does not match its kind');
  });

  it('a stored rename without its previous name is refused', () => {
    expect(() =>
      MaterialImportChange.fromPersistence(
        'rename',
        Identity.new(),
        null,
        'B-1',
        'برنج زرد',
        'B-1',
      ),
    ).toThrow('does not match its kind');
  });

  it('only the three change kinds are change kinds', () => {
    expect(
      ['register', 'changeCode', 'rename', 'unchanged', 'invalid'].map((kind) =>
        isMaterialImportChangeKind(kind),
      ),
    ).toEqual([true, true, true, false, false]);
  });

  it('a revision restores its previous name and code', () => {
    const sut = MaterialImportChange.codeChange(
      Identity.new(),
      'مسی',
      'M-101',
      'M-201',
    );

    expect(sut.restoredNameAndCode()).toEqual({ name: 'مسی', code: 'M-101' });
  });

  it('asking a registration what to restore is refused', () => {
    const sut = MaterialImportChange.registration(Identity.new(), 'روی', 'Z-1');

    expect(() => sut.restoredNameAndCode()).toThrow(
      'A registration has no name and code to restore',
    );
  });
});
