import { MaterialImportFileUnreadable } from '@products/application/exceptions';
import { MaterialImportRow } from '@products/domain/service/material-import-classifier';

/** One cell as a spreadsheet reader hands it over; `null` when empty. */
export type SheetCell = string | number | boolean | Date | null;

const CODE_HEADER = 'کد کالا';
const NAME_HEADER = 'نام کالا';

/**
 * The item rows of the accounting software's export, from its first sheet's
 * cells (`cells[i]` is spreadsheet row `i + 1`). The header row is the first
 * one holding both «کد کالا» and «نام کالا»; it need not be row 1 (the real
 * export leaves row 1 blank). Every later row is one item — only a row whose
 * name and code are both empty is skipped — numbered as Excel numbers it.
 * Every other column is ignored. A cell is read as its text, trimmed; the
 * classifier normalises digits.
 *
 * Throws `MaterialImportFileUnreadable` when there is no such header row.
 */
export function materialImportRowsFromSheet(
  cells: readonly (readonly SheetCell[])[],
): MaterialImportRow[] {
  const headerIndex = cells.findIndex(
    (row) => columnOf(row, CODE_HEADER) >= 0 && columnOf(row, NAME_HEADER) >= 0,
  );
  if (headerIndex === -1) {
    throw MaterialImportFileUnreadable.withoutHeaderRow();
  }
  const codeColumn = columnOf(cells[headerIndex], CODE_HEADER);
  const nameColumn = columnOf(cells[headerIndex], NAME_HEADER);

  const rows: MaterialImportRow[] = [];
  for (const [index, cellsOfRow] of cells.entries()) {
    if (index <= headerIndex) continue;
    const name = textOf(cellsOfRow[nameColumn]);
    const code = textOf(cellsOfRow[codeColumn]);
    if (name || code) {
      rows.push({ row: index + 1, name, code });
    }
  }
  return rows;
}

function columnOf(row: readonly SheetCell[], header: string): number {
  return row.findIndex((cell) => textOf(cell) === header);
}

function textOf(cell: SheetCell | undefined): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}
