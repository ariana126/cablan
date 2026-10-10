import type { CellObject, SheetData } from 'write-excel-file/browser';
import type { XlsxCell } from './xlsx-downloader';

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

/** What `write-excel-file` takes as a sheet's `columns` option: one entry per column. */
export interface XlsxColumnLayout {
  readonly width: number;
}

export interface XlsxSheetLayout {
  readonly data: SheetData;
  readonly columns: XlsxColumnLayout[];
}

/** Whether a code point is drawn about twice as wide as a Latin letter (CJK, full-width, emoji). */
function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  );
}

/** Zero-width marks (combining diacritics, ZWNJ/ZWJ, bidi controls) that take no room. */
function isInvisible(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x064b && codePoint <= 0x065f) ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e)
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
function lineWidths(cell: XlsxCell): number[] {
  return String(cell).split(/\r?\n/).map(lineWidth);
}

function columnCount(grid: readonly (readonly XlsxCell[])[]): number {
  return grid.reduce<number>((widest, row) => Math.max(widest, row.length), 0);
}

function columnWidth(grid: readonly (readonly XlsxCell[])[], column: number): number {
  const widest = grid.reduce<number>((current, row, rowIndex) => {
    const cell = row[column];
    if (cell === undefined) {
      return current;
    }
    const factor = rowIndex === 0 ? BOLD_FACTOR : 1;
    return Math.max(current, Math.max(...lineWidths(cell)) * factor);
  }, 0);
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.ceil(widest) + WIDTH_PADDING));
}

/** How many lines a row needs once each of its cells wraps inside its column's width. */
function rowLineCount(row: readonly XlsxCell[], widths: readonly number[]): number {
  return row.reduce<number>((most, cell, column) => {
    const available = Math.max(1, widths[column] - WIDTH_PADDING);
    const lines = lineWidths(cell).reduce(
      (total, width) => total + Math.max(1, Math.ceil(width / available)),
      0,
    );
    return Math.max(most, lines);
  }, 1);
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
export function layOutXlsxSheet(grid: readonly (readonly XlsxCell[])[]): XlsxSheetLayout {
  const columns = columnCount(grid);
  const widths = Array.from({ length: columns }, (_, column) => columnWidth(grid, column));

  const data = grid.map((row, rowIndex) => {
    const lines = rowLineCount(row, widths);
    return Array.from({ length: columns }, (_, column): CellObject => {
      const isHeader = rowIndex === 0;
      return {
        value: row[column] ?? '',
        wrap: true,
        borderStyle: 'thin',
        borderColor: BORDER_COLOR,
        ...(isHeader ? { fontWeight: 'bold', backgroundColor: HEADER_BACKGROUND } : {}),
        ...(lines > 1 ? { height: lines * LINE_HEIGHT } : {}),
      } as CellObject;
    });
  });

  return { data, columns: widths.map((width) => ({ width })) };
}
