import writeXlsxFile from 'write-excel-file/node';

import { SpreadsheetGrid } from './spreadsheet-cell';
import { layOutXlsxSheet } from './xlsx-sheet-layout';

export interface XlsxWorkbookOptions {
  /** Lay the sheet out right to left: column A on the right, as a Persian reader expects. */
  readonly rightToLeft?: boolean;
}

/**
 * Writes a grid — header row first — to a single-sheet `.xlsx` workbook, laid out by
 * `layOutXlsxSheet` (fitted widths, wrapped rows, thin borders, a bold grey header). Strings are
 * written as text and numbers as numbers; nothing is inferred from a string's content, so an MI
 * code like `1001` stays text. The sheet reads left to right unless `rightToLeft` is set.
 */
export async function renderXlsxWorkbook(
  grid: SpreadsheetGrid,
  options: XlsxWorkbookOptions = {},
): Promise<Buffer> {
  const { data, columns } = layOutXlsxSheet(grid);
  return writeXlsxFile(data, {
    columns,
    rightToLeft: options.rightToLeft ?? false,
  }).toBuffer();
}
