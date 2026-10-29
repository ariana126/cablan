import { MaterialRegisteredByImport } from '../events/material-registered-by-import.event';
import { MaterialRevisedByImport } from '../events/material-revised-by-import.event';
import { MaterialsImported } from '../events/materials-imported.event';
import { Material } from '../material.aggregate';
import { MaterialCode } from '../value/material-code.vo';
import { MaterialName } from '../value/material-name.vo';
import { applyMaterialImport } from './material-import-application';
import { classifyMaterialImportRows } from './material-import-classifier';

const IMPORTED_AT = new Date('2026-10-29T08:00:00.000Z');

function registeredMaterial(name: string, code: string): Material {
  const material = Material.register(
    MaterialName.fromString(name),
    MaterialCode.fromString(code),
  );
  material.releaseEvents();
  return material;
}

function registeredMaterials() {
  const copper = registeredMaterial('مسی', 'M-101');
  const brass = registeredMaterial('برنج', 'B-1');
  return { copper, brass, all: [copper, brass] };
}

function applying(rows: [number, string, string][]) {
  const { copper, brass, all } = registeredMaterials();
  const classified = classifyMaterialImportRows(
    rows.map(([row, name, code]) => ({ row, name, code })),
    all,
  );
  return { copper, brass, all, classified };
}

describe('applyMaterialImport', () => {
  it('registers, re-codes and renames materials, returning every touched one in file order', () => {
    const { copper, brass, all, classified } = applying([
      [3, 'آلومینیوم', 'A-1'],
      [4, 'مسی', 'M-201'],
      [5, 'برنج زرد', 'B-1'],
    ]);

    const sut = applyMaterialImport(classified, all, IMPORTED_AT);

    expect(
      sut.touchedMaterials.map((each) => [
        each.name().asString(),
        each.code().asString(),
      ]),
    ).toEqual([
      ['آلومینیوم', 'A-1'],
      ['مسی', 'M-201'],
      ['برنج زرد', 'B-1'],
    ]);
    expect(sut.touchedMaterials.slice(1)).toEqual([copper, brass]);
  });

  it('records the import at the given instant with one MaterialsImported event of its changes', () => {
    const { copper, all, classified } = applying([
      [3, 'آلومینیوم', 'A-1'],
      [4, 'مسی', 'M-201'],
    ]);

    const sut = applyMaterialImport(classified, all, IMPORTED_AT);

    const aluminium = sut.touchedMaterials[0];
    expect(sut.materialImport.importedAt()).toEqual(IMPORTED_AT);
    expect(sut.materialImport.releaseEvents()).toEqual([
      new MaterialsImported(sut.materialImport.id.asString(), [
        {
          kind: 'register',
          materialId: aluminium.id.asString(),
          previousName: null,
          previousCode: null,
          name: 'آلومینیوم',
          code: 'A-1',
        },
        {
          kind: 'changeCode',
          materialId: copper.id.asString(),
          previousName: 'مسی',
          previousCode: 'M-101',
          name: 'مسی',
          code: 'M-201',
        },
      ]),
    ]);
  });

  it('each touched material records only its import-specific event', () => {
    const { brass, all, classified } = applying([
      [3, 'آلومینیوم', 'A-1'],
      [5, 'برنج زرد', 'B-1'],
    ]);

    const sut = applyMaterialImport(classified, all, IMPORTED_AT);

    const [aluminium] = sut.touchedMaterials;
    expect(aluminium.releaseEvents()).toEqual([
      new MaterialRegisteredByImport(
        aluminium.id.asString(),
        'آلومینیوم',
        'A-1',
      ),
    ]);
    expect(brass.releaseEvents()).toEqual([
      new MaterialRevisedByImport(
        brass.id.asString(),
        'برنج',
        'B-1',
        'برنج زرد',
        'B-1',
      ),
    ]);
  });

  it('refuses rows that still carry an error', () => {
    const { all, classified } = applying([[4, 'مسی', 'B-1']]);

    expect(() => applyMaterialImport(classified, all, IMPORTED_AT)).toThrow(
      'Only error-free change rows can be applied',
    );
  });
});
