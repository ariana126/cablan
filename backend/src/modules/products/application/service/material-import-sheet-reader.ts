import { SheetCell } from './material-import-sheet';

/**
 * The port for "what cells does this uploaded workbook's first sheet hold".
 * `cells[i]` must be spreadsheet row `i + 1` — blank rows kept, not dropped —
 * since the rows are reported back by their Excel row number.
 *
 * Throws `MaterialImportFileUnreadable` when the file is not a readable
 * `.xlsx`. Bound in infrastructure.
 */
export abstract class MaterialImportSheetReader {
  abstract readFirstSheet(file: Buffer): Promise<SheetCell[][]>;
}
