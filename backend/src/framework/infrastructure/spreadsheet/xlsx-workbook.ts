import writeXlsxFile from 'write-excel-file/node';

import { SpreadsheetGrid } from './spreadsheet-cell';
import { layOutXlsxSheet } from './xlsx-sheet-layout';

/**
 * Writes a grid — header row first — to a single-sheet `.xlsx` workbook, laid out by
 * `layOutXlsxSheet` (fitted widths, wrapped rows, thin borders, a bold grey header). Strings are
 * written as text and numbers as numbers; nothing is inferred from a string's content, so an MI
 * code like `1001` stays text.
 */
export async function renderXlsxWorkbook(
  grid: SpreadsheetGrid,
): Promise<Buffer> {
  const { data, columns } = layOutXlsxSheet(grid);
  return writeXlsxFile(data, { columns }).toBuffer();
}
