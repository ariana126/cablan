import { Identity } from '@framework/domain';

import { MaterialImportReverted } from './events/material-import-reverted.event';
import { MaterialsImported } from './events/materials-imported.event';
import { MaterialImportAlreadyReverted } from './exceptions/material-import-already-reverted.exception';
import { MaterialImport } from './material-import.aggregate';
import { MaterialImportChange } from './value/material-import-change.vo';

const IMPORTED_AT = new Date('2026-10-29T08:00:00.000Z');
const REVERTED_AT = new Date('2026-10-29T09:00:00.000Z');

function changes() {
  const aluminiumId = Identity.new();
  const copperId = Identity.new();
  return {
    aluminiumId,
    copperId,
    list: [
      MaterialImportChange.registration(aluminiumId, 'آلومینیوم', 'A-1'),
      MaterialImportChange.codeChange(copperId, 'مسی', 'M-101', 'M-201'),
    ],
  };
}

function recordedImport(): MaterialImport {
  return MaterialImport.fromPersistence(
    Identity.new(),
    changes().list,
    IMPORTED_AT,
    null,
  );
}

describe('MaterialImport', () => {
  it('recording an import records one MaterialsImported event with its changes in order', () => {
    const { aluminiumId, copperId, list } = changes();

    const sut = MaterialImport.record(list, IMPORTED_AT);

    expect(sut.releaseEvents()).toEqual([
      new MaterialsImported(sut.id.asString(), [
        {
          kind: 'register',
          materialId: aluminiumId.asString(),
          previousName: null,
          previousCode: null,
          name: 'آلومینیوم',
          code: 'A-1',
        },
        {
          kind: 'changeCode',
          materialId: copperId.asString(),
          previousName: 'مسی',
          previousCode: 'M-101',
          name: 'مسی',
          code: 'M-201',
        },
      ]),
    ]);
  });

  it('an import without any change cannot be recorded', () => {
    expect(() => MaterialImport.record([], IMPORTED_AT)).toThrow(
      'A material import must change at least one material',
    );
  });

  it('an import changing one material twice cannot be recorded', () => {
    const copperId = Identity.new();

    expect(() =>
      MaterialImport.record(
        [
          MaterialImportChange.codeChange(copperId, 'مسی', 'M-101', 'M-201'),
          MaterialImportChange.rename(copperId, 'M-101', 'مسی', 'مس قرمز'),
        ],
        IMPORTED_AT,
      ),
    ).toThrow('A material import must change each material at most once');
  });

  it('reverting an import records one MaterialImportReverted event carrying its changes', () => {
    const sut = recordedImport();

    sut.revert(REVERTED_AT);

    expect(sut.releaseEvents()).toEqual([
      new MaterialImportReverted(
        sut.id.asString(),
        sut.changes().map((change) => change.snapshot()),
      ),
    ]);
  });

  it('a reverted import is marked reverted at the given instant', () => {
    const sut = recordedImport();

    sut.revert(REVERTED_AT);

    expect(sut.isReverted()).toBe(true);
    expect(sut.revertedAt()).toEqual(REVERTED_AT);
  });

  it('an import already reverted cannot be reverted again', () => {
    const sut = recordedImport();
    sut.revert(REVERTED_AT);

    expect(() => sut.revert(REVERTED_AT)).toThrow(
      MaterialImportAlreadyReverted.withId(sut.id.asString()),
    );
  });

  it('reconstructing an import from persistence records no event', () => {
    const sut = recordedImport();

    expect(sut.releaseEvents()).toEqual([]);
    expect(sut.importedAt()).toEqual(IMPORTED_AT);
    expect(sut.isReverted()).toBe(false);
  });
});
