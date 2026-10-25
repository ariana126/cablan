import { strFromU8, unzipSync } from 'fflate';
import readExcelFile from 'read-excel-file/node';

import { renderXlsxWorkbook } from './xlsx-workbook';

function sheetXml(workbook: Buffer): string {
  return strFromU8(unzipSync(workbook)['xl/worksheets/sheet1.xml']);
}

function stylesXml(workbook: Buffer): string {
  return strFromU8(unzipSync(workbook)['xl/styles.xml']);
}

describe('renderXlsxWorkbook', () => {
  it('writes one sheet holding the grid, strings as text and numbers as numbers', async () => {
    const workbook = await renderXlsxWorkbook([
      ['نام جز', 'وزن مواد اولیه'],
      ['مغزی', 10.5],
      ['روکش', ''],
    ]);

    const [sheet] = await readExcelFile(workbook);
    expect(sheet.data).toEqual([
      ['نام جز', 'وزن مواد اولیه'],
      ['مغزی', 10.5],
      ['روکش', null],
    ]);
  });

  it('keeps a numeric-looking string as text', async () => {
    const workbook = await renderXlsxWorkbook([['کد MI'], ['1001']]);

    const [sheet] = await readExcelFile(workbook);
    expect(sheet.data).toEqual([['کد MI'], ['1001']]);
  });

  it('carries the fitted column widths into the file', async () => {
    const workbook = await renderXlsxWorkbook([['a', 'b'.repeat(30)]]);

    expect(sheetXml(workbook)).toMatch(/<col [^>]*min="1" max="1" width="8"/);
    expect(sheetXml(workbook)).toMatch(/<col [^>]*min="2" max="2" width="37"/);
  });

  it('lays the sheet out right to left when asked', async () => {
    const workbook = await renderXlsxWorkbook([['الف']], { rightToLeft: true });

    expect(sheetXml(workbook)).toMatch(/<sheetView [^>]*rightToLeft="1"/);
  });

  it('lays the sheet out left to right by default', async () => {
    const workbook = await renderXlsxWorkbook([['الف']]);

    expect(sheetXml(workbook)).not.toContain('rightToLeft');
  });

  it('styles the header bold on a grey fill and borders every cell thinly', async () => {
    const workbook = await renderXlsxWorkbook([['الف'], ['ب']]);

    const styles = stylesXml(workbook);
    expect(styles).toContain('<b/>');
    expect(styles).toMatch(/F2F2F2/i);
    expect(styles).toContain('style="thin"');
  });
});
