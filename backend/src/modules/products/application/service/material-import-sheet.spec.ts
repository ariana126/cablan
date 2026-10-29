import { MaterialImportFileUnreadable } from '@products/application/exceptions';

import { materialImportRowsFromSheet } from './material-import-sheet';

const HEADER = ['ردیف', 'نوع', 'کد کالا', 'نام کالا', 'واحد'];

describe('materialImportRowsFromSheet', () => {
  it('reads the rows below a header that is not on the first row, numbered as Excel numbers them', () => {
    const sut = materialImportRowsFromSheet([
      [null, null, null, null, null],
      HEADER,
      [1, 'کالا', '01/01/101', 'مسی', 'کیلوگرم'],
      [2, 'کالا', '01/01/102', 'برنج', 'کیلوگرم'],
    ]);

    expect(sut).toEqual([
      { row: 3, name: 'مسی', code: '01/01/101' },
      { row: 4, name: 'برنج', code: '01/01/102' },
    ]);
  });

  it('finds the two columns by their header, wherever they sit', () => {
    const sut = materialImportRowsFromSheet([
      ['نام کالا', 'واحد', 'کد کالا'],
      ['قلع', 'کیلوگرم', 'T-1'],
    ]);

    expect(sut).toEqual([{ row: 2, name: 'قلع', code: 'T-1' }]);
  });

  it('recognises header cells with surrounding whitespace', () => {
    const sut = materialImportRowsFromSheet([
      [' کد کالا ', 'نام کالا  '],
      ['A-1', 'آلومینیوم'],
    ]);

    expect(sut).toEqual([{ row: 2, name: 'آلومینیوم', code: 'A-1' }]);
  });

  it('skips a row whose name and code are both empty, keeping the numbering of the rows after it', () => {
    const sut = materialImportRowsFromSheet([
      ['کد کالا', 'نام کالا'],
      ['A-1', 'آلومینیوم'],
      [null, ' '.repeat(3)],
      ['Z-1', 'روی'],
    ]);

    expect(sut).toEqual([
      { row: 2, name: 'آلومینیوم', code: 'A-1' },
      { row: 4, name: 'روی', code: 'Z-1' },
    ]);
  });

  it('keeps a row with only one of the two cells filled, the other empty', () => {
    const sut = materialImportRowsFromSheet([
      ['کد کالا', 'نام کالا'],
      [null, 'آلومینیوم'],
      ['A-1'],
    ]);

    expect(sut).toEqual([
      { row: 2, name: 'آلومینیوم', code: '' },
      { row: 3, name: '', code: 'A-1' },
    ]);
  });

  it('reads a numeric cell as its text, trimmed', () => {
    const sut = materialImportRowsFromSheet([
      ['کد کالا', 'نام کالا'],
      [1001, ' مس 2 '],
    ]);

    expect(sut).toEqual([{ row: 2, name: 'مس 2', code: '1001' }]);
  });

  it('a sheet with no header row naming both columns is unreadable', () => {
    expect(() =>
      materialImportRowsFromSheet([
        ['ردیف', 'کد کالا', 'واحد'],
        [1, 'A-1', 'کیلوگرم'],
      ]),
    ).toThrow(MaterialImportFileUnreadable);
  });

  it('an empty sheet is unreadable', () => {
    expect(() => materialImportRowsFromSheet([])).toThrow(
      MaterialImportFileUnreadable,
    );
  });
});
