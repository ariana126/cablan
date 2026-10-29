import { Material } from '../material.aggregate';
import { MaterialCode } from '../value/material-code.vo';
import { MaterialName } from '../value/material-name.vo';
import { classifyMaterialImportRows } from './material-import-classifier';

function material(name: string, code: string): Material {
  return Material.register(
    MaterialName.fromString(name),
    MaterialCode.fromString(code),
  );
}

function registeredMaterials() {
  const copper = material('مسی', 'M-101');
  const brass = material('برنج', 'B-1');
  const tin = material('قلع', 'T-1');
  return { copper, brass, tin, all: [copper, brass, tin] };
}

describe('classifyMaterialImportRows', () => {
  it('a row whose name and code are both unknown registers a new material', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [{ row: 3, name: 'آلومینیوم', code: 'A-1' }],
      all,
    );

    expect(result).toEqual([
      {
        row: 3,
        kind: 'register',
        name: 'آلومینیوم',
        code: 'A-1',
        materialId: null,
        previousName: null,
        previousCode: null,
        errors: [],
      },
    ]);
  });

  it('a row naming a known material with another code changes that material code', () => {
    const { copper, all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [{ row: 4, name: 'مسی', code: 'M-201' }],
      all,
    );

    expect(result).toEqual([
      {
        row: 4,
        kind: 'changeCode',
        name: 'مسی',
        code: 'M-201',
        materialId: copper.id.asString(),
        previousName: 'مسی',
        previousCode: 'M-101',
        errors: [],
      },
    ]);
  });

  it('a row with an unknown name and a known code renames the material holding that code', () => {
    const { brass, all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [{ row: 5, name: 'برنج زرد', code: 'B-1' }],
      all,
    );

    expect(result).toEqual([
      {
        row: 5,
        kind: 'rename',
        name: 'برنج زرد',
        code: 'B-1',
        materialId: brass.id.asString(),
        previousName: 'برنج',
        previousCode: 'B-1',
        errors: [],
      },
    ]);
  });

  it('a row matching a material by name and code is left out as unchanged', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [{ row: 3, name: 'مسی', code: 'M-101' }],
      all,
    );

    expect(result).toEqual([]);
  });

  it('materials absent from the file are not part of the result', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [{ row: 3, name: 'آلومینیوم', code: 'A-1' }],
      all,
    );

    expect(result.map((item) => item.name)).toEqual(['آلومینیوم']);
  });

  it('keeps the file order of the rows', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [
        { row: 7, name: 'روی', code: 'Z-1' },
        { row: 3, name: 'مسی', code: 'M-201' },
        { row: 5, name: 'آلومینیوم', code: 'A-1' },
      ],
      all,
    );

    expect(result.map((item) => item.row)).toEqual([7, 3, 5]);
  });

  it('a code change onto a code held by another material is marked code-taken', () => {
    const { all } = registeredMaterials();

    const [sut] = classifyMaterialImportRows(
      [{ row: 3, name: 'مسی', code: 'B-1' }],
      all,
    );

    expect(sut.kind).toBe('changeCode');
    expect(sut.errors).toEqual(['code-taken']);
  });

  it('a row without a code is invalid and marked code-required', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [{ row: 3, name: 'آلومینیوم', code: '' }],
      all,
    );

    expect(result).toEqual([
      {
        row: 3,
        kind: 'invalid',
        name: 'آلومینیوم',
        code: '',
        materialId: null,
        previousName: null,
        previousCode: null,
        errors: ['code-required'],
      },
    ]);
  });

  it('a row without a name is invalid and marked name-required', () => {
    const { all } = registeredMaterials();

    const [sut] = classifyMaterialImportRows(
      [{ row: 3, name: '', code: 'A-1' }],
      all,
    );

    expect(sut.kind).toBe('invalid');
    expect(sut.errors).toEqual(['name-required']);
  });

  it('a row of whitespace for both name and code carries both errors', () => {
    const [sut] = classifyMaterialImportRows(
      [{ row: 3, name: '  ', code: ' ' }],
      [],
    );

    expect(sut.errors).toEqual(['name-required', 'code-required']);
  });

  it('every row sharing a name in the file is marked duplicate-name-in-file', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [
        { row: 3, name: 'مسی', code: 'M-101' },
        { row: 4, name: 'مسی', code: 'M-102' },
      ],
      all,
    );

    expect(result.map((item) => [item.row, item.kind, item.errors])).toEqual([
      [3, 'unchanged', ['duplicate-name-in-file']],
      [4, 'changeCode', ['duplicate-name-in-file']],
    ]);
  });

  it('every row sharing a code in the file is marked duplicate-code-in-file', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [
        { row: 3, name: 'آلومینیوم', code: 'A-1' },
        { row: 4, name: 'روی', code: 'A-1' },
        { row: 5, name: 'سرب', code: 'P-1' },
      ],
      all,
    );

    expect(result.map((item) => [item.row, item.errors])).toEqual([
      [3, ['duplicate-code-in-file']],
      [4, ['duplicate-code-in-file']],
      [5, []],
    ]);
  });

  it('two rows changing one material in different ways are both marked material-targeted-twice', () => {
    const { copper, all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [
        { row: 3, name: 'مسی', code: 'M-201' },
        { row: 4, name: 'مس قرمز', code: 'M-101' },
      ],
      all,
    );

    expect(
      result.map((item) => [item.kind, item.materialId, item.errors]),
    ).toEqual([
      ['changeCode', copper.id.asString(), ['material-targeted-twice']],
      ['rename', copper.id.asString(), ['material-targeted-twice']],
    ]);
  });

  it('compares and reports names and codes as materials hold them: English digits, codes trimmed', () => {
    const { all } = registeredMaterials();

    const result = classifyMaterialImportRows(
      [
        { row: 3, name: 'مسی', code: ' M-۱۰۱ ' },
        { row: 4, name: 'مس شماره ۲', code: 'C-٢' },
      ],
      all,
    );

    expect(result.map((item) => [item.kind, item.name, item.code])).toEqual([
      ['register', 'مس شماره 2', 'C-2'],
    ]);
  });

  it('a name differing only in surrounding spaces is another name, as for materials', () => {
    const { all } = registeredMaterials();

    const [sut] = classifyMaterialImportRows(
      [{ row: 3, name: 'مسی ', code: 'Z-9' }],
      all,
    );

    expect([sut.kind, sut.name]).toEqual(['register', 'مسی ']);
  });

  it('two codes differing only in Persian digits are one code in the file', () => {
    const result = classifyMaterialImportRows(
      [
        { row: 3, name: 'آلومینیوم', code: 'A-1' },
        { row: 4, name: 'روی', code: 'A-۱' },
      ],
      [],
    );

    expect(result.map((item) => item.errors)).toEqual([
      ['duplicate-code-in-file'],
      ['duplicate-code-in-file'],
    ]);
  });
});
