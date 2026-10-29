import { MaterialImportFileUnreadable } from '@products/application/exceptions';
import writeXlsxFile from 'write-excel-file/node';

import { XlsxMaterialImportSheetReader } from './xlsx-material-import-sheet-reader';

describe('XlsxMaterialImportSheetReader', () => {
  it("reads the first sheet's cells row by row, a blank first row kept so rows keep Excel's numbering", async () => {
    const workbook = await writeXlsxFile([
      [null, null],
      [{ value: 'کد کالا' }, { value: 'نام کالا' }],
      [{ value: '01/01/101' }, { value: 'مسی' }],
      [{ value: 1001 }, { value: 'برنج' }],
    ]).toBuffer();
    const sut = new XlsxMaterialImportSheetReader();

    const cells = await sut.readFirstSheet(workbook);

    expect(cells).toEqual([
      [null, null],
      ['کد کالا', 'نام کالا'],
      ['01/01/101', 'مسی'],
      [1001, 'برنج'],
    ]);
  });

  it('a file that is not an xlsx workbook is unreadable', async () => {
    const sut = new XlsxMaterialImportSheetReader();

    await expect(
      sut.readFirstSheet(Buffer.from('ردیف,کد کالا,نام کالا')),
    ).rejects.toBeInstanceOf(MaterialImportFileUnreadable);
  });
});
