import { describe, expect, it } from 'vitest';

import { AppMaterialImportChange } from '../../core/materials/material-import-gateway';
import { describeImportChange, importRowErrorLabel } from './material-import-change';

function change(overrides: Partial<AppMaterialImportChange>): AppMaterialImportChange {
  return {
    row: 3,
    kind: 'register',
    name: '',
    code: '',
    previousName: '',
    previousCode: '',
    errors: [],
    ...overrides,
  };
}

describe('describeImportChange', () => {
  it('words a registration with the new name and code', () => {
    expect(describeImportChange(change({ kind: 'register', name: 'آلومینیوم', code: 'A-1' }))).toBe(
      'ثبت مواد اولیه جدید "آلومینیوم" با کد "A-1"',
    );
  });

  it('words a code change from the material’s current code to the file’s', () => {
    expect(
      describeImportChange(
        change({ kind: 'changeCode', name: 'مسی', code: 'M-201', previousCode: 'M-101' }),
      ),
    ).toBe('تغییر کد "مسی" از "M-101" به "M-201"');
  });

  it('words a rename from the material’s current name to the file’s', () => {
    expect(
      describeImportChange(
        change({ kind: 'rename', name: 'برنج زرد', code: 'B-1', previousName: 'برنج' }),
      ),
    ).toBe('تغییر نام کد "B-1" از "برنج" به "برنج زرد"');
  });

  it('shows an unchanged row in error by its name and code as the file has them', () => {
    expect(describeImportChange(change({ kind: 'unchanged', name: 'مسی', code: 'M-101' }))).toBe(
      '"مسی" با کد "M-101"',
    );
  });

  it('shows a row without a code by its name alone', () => {
    expect(describeImportChange(change({ kind: 'invalid', name: 'آلومینیوم', code: '' }))).toBe(
      '"آلومینیوم"',
    );
  });

  it('shows a row without a name by its code alone', () => {
    expect(describeImportChange(change({ kind: 'invalid', name: '', code: 'A-1' }))).toBe(
      'کد "A-1"',
    );
  });
});

describe('importRowErrorLabel', () => {
  it.each([
    ['name-required', 'اسم مواد اولیه خالی است'],
    ['code-required', 'کد مواد اولیه خالی است'],
    ['duplicate-name-in-file', 'اسم مواد اولیه در اکسل تکراری است'],
    ['duplicate-code-in-file', 'کد مواد اولیه در اکسل تکراری است'],
    ['code-taken', 'کد مواد اولیه تکراری است و متعلق به مواد اولیه دیگری است'],
    ['material-targeted-twice', 'این مواد اولیه در چند ردیف اکسل تغییر کرده است'],
  ] as const)("words '%s' in Persian", (error, label) => {
    expect(importRowErrorLabel(error)).toBe(label);
  });

  it('never shows an unknown code as is', () => {
    expect(importRowErrorLabel('something-new')).toBe('این ردیف خطا دارد');
  });
});
