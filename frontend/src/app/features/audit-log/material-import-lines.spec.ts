import { describe, expect, it } from 'vitest';

import { materialImportLine } from './material-import-lines';

describe('materialImportLine', () => {
  it('words a registered material with its name and code', () => {
    expect(
      materialImportLine({
        field: 'importedMaterial:A-1',
        previousValue: '',
        newValue: 'آلومینیوم',
      }),
    ).toBe('ثبت مواد اولیه جدید با نام "آلومینیوم" و کد "A-1"');
  });

  it('words a reverted registration as the material’s removal', () => {
    expect(
      materialImportLine({
        field: 'importedMaterial:A-1',
        previousValue: 'آلومینیوم',
        newValue: '',
      }),
    ).toBe('حذف مواد اولیه "آلومینیوم" با کد "A-1"');
  });

  it('words a code change with the material’s name and both codes', () => {
    expect(
      materialImportLine({ field: 'materialCode:مسی', previousValue: 'M-101', newValue: 'M-201' }),
    ).toBe('تغییر کد مواد اولیه "مسی" از "M-101" به "M-201"');
  });

  it('words a rename with the material’s code and both names', () => {
    expect(
      materialImportLine({
        field: 'materialName:B-1',
        previousValue: 'برنج',
        newValue: 'برنج زرد',
      }),
    ).toBe('تغییر نام مواد اولیه با کد "B-1" از "برنج" به "برنج زرد"');
  });

  it('keeps a colon that belongs to the name or code itself', () => {
    expect(
      materialImportLine({ field: 'materialName:01:02', previousValue: 'الف', newValue: 'ب' }),
    ).toBe('تغییر نام مواد اولیه با کد "01:02" از "الف" به "ب"');
  });

  it('still shows a line it has no sentence for, as field and values', () => {
    expect(materialImportLine({ field: 'somethingNew', previousValue: 'a', newValue: 'b' })).toBe(
      'somethingNew: "a" به "b"',
    );
  });
});
