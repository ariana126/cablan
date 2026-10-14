import { SpreadsheetCell } from './spreadsheet-cell';

/** The widest a column grows before its text wraps onto further lines, in characters. */
const MAX_COLUMN_WIDTH = 60;
const MIN_COLUMN_WIDTH = 8;
/** Room for the cell's own padding and, on the header, the bold weight. */
const WIDTH_PADDING = 2;
const BOLD_FACTOR = 1.15;
/** Excel's default row height, in points — one wrapped line. */
const LINE_HEIGHT = 15;

const HEADER_BACKGROUND = '#F2F2F2';
const BORDER_COLOR = '#000000';

/** One laid-out cell, in the shape `write-excel-file` takes a styled cell. */
export interface XlsxCellLayout {
  readonly value: SpreadsheetCell;
  readonly wrap: true;
  readonly borderStyle: 'thin';
  readonly borderColor: string;
  readonly fontWeight?: 'bold';
  readonly backgroundColor?: string;
  readonly height?: number;
}

/** What `write-excel-file` takes as a sheet's `columns` option: one entry per column. */
export interface XlsxColumnLayout {
  readonly width: number;
}

export interface XlsxSheetLayout {
  readonly data: XlsxCellLayout[][];
  readonly columns: XlsxColumnLayout[];
}

/** Whether a code point is drawn about twice as wide as a Latin letter (CJK, full-width, emoji). */
function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x11_00 && codePoint <= 0x11_5f) ||
    (codePoint >= 0x2e_80 && codePoint <= 0xa4_cf) ||
    (codePoint >= 0xac_00 && codePoint <= 0xd7_a3) ||
    (codePoint >= 0xf9_00 && codePoint <= 0xfa_ff) ||
    (codePoint >= 0xfe_30 && codePoint <= 0xfe_6f) ||
    (codePoint >= 0xff_00 && codePoint <= 0xff_60) ||
    (codePoint >= 0x1_f3_00 && codePoint <= 0x1_fa_ff)
  );
}

/** Zero-width marks (combining diacritics, ZWNJ/ZWJ, bidi controls) that take no room. */
function isInvisible(codePoint: number): boolean {
  return (
    (codePoint >= 0x3_00 && codePoint <= 0x3_6f) ||
    (codePoint >= 0x6_4b && codePoint <= 0x6_5f) ||
    (codePoint >= 0x20_0b && codePoint <= 0x20_0f) ||
    (codePoint >= 0x20_2a && codePoint <= 0x20_2e)
  );
}

function lineWidth(line: string): number {
  let width = 0;
  for (const character of line) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (isInvisible(codePoint)) {
      continue;
    }
    width += isWide(codePoint) ? 2 : 1;
  }
  return width;
}

/** The width of each of a cell's lines, so a multi-line value is measured by its longest line. */
function lineWidths(cell: SpreadsheetCell): number[] {
  return String(cell)
    .split(/\r?\n/)
    .map((line) => lineWidth(line));
}

function columnCount(grid: readonly (readonly SpreadsheetCell[])[]): number {
  let widest = 0;
  for (const row of grid) {
    widest = Math.max(widest, row.length);
  }
  return widest;
}

function columnWidth(
  grid: readonly (readonly SpreadsheetCell[])[],
  column: number,
): number {
  let widest = 0;
  for (const [rowIndex, row] of grid.entries()) {
    if (column >= row.length) {
      continue;
    }
    const factor = rowIndex === 0 ? BOLD_FACTOR : 1;
    widest = Math.max(widest, Math.max(...lineWidths(row[column])) * factor);
  }
  return Math.min(
    MAX_COLUMN_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, Math.ceil(widest) + WIDTH_PADDING),
  );
}

/** How many lines a row needs once each of its cells wraps inside its column's width. */
function rowLineCount(
  row: readonly SpreadsheetCell[],
  widths: readonly number[],
): number {
  let most = 1;
  for (const [column, cell] of row.entries()) {
    const available = Math.max(1, widths[column] - WIDTH_PADDING);
    let lines = 0;
    for (const width of lineWidths(cell)) {
      lines += Math.max(1, Math.ceil(width / available));
    }
    most = Math.max(most, lines);
  }
  return most;
}

/**
 * Lays a plain grid out like a hand-made worksheet — a pure function of the grid, so every export
 * shares it and none can truncate a cell:
 *
 * - each column is as wide as its longest value (header included, wide glyphs counted double),
 *   plus a little padding, capped so a very long text wraps instead of making a huge column;
 * - a row that has to wrap gets the height of its tallest cell, so nothing is cut off;
 * - every cell of the data range — and only that range — has a thin solid border;
 * - the first row is the header: bold, on a light grey fill.
 *
 * The values themselves are passed through untouched, and a row shorter than the widest is padded
 * with empty bordered cells so the range stays a clean rectangle.
 */
export function layOutXlsxSheet(
  grid: readonly (readonly SpreadsheetCell[])[],
): XlsxSheetLayout {
  const columns = columnCount(grid);
  const widths = Array.from({ length: columns }, (_, column) =>
    columnWidth(grid, column),
  );

  const data = grid.map((row, rowIndex) => {
    const lines = rowLineCount(row, widths);
    const isHeader = rowIndex === 0;
    return Array.from(
      { length: columns },
      (_, column): XlsxCellLayout => ({
        value: column < row.length ? row[column] : '',
        wrap: true,
        borderStyle: 'thin',
        borderColor: BORDER_COLOR,
        ...(isHeader
          ? { fontWeight: 'bold', backgroundColor: HEADER_BACKGROUND }
          : {}),
        ...(lines > 1 ? { height: lines * LINE_HEIGHT } : {}),
      }),
    );
  });

  return { data, columns: widths.map((width) => ({ width })) };
}
