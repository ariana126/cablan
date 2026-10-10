import { describe, expect, it } from 'vitest';
import type { CellObject } from 'write-excel-file/browser';
import { layOutXlsxSheet } from './xlsx-sheet-layout';

function cellAt(layout: ReturnType<typeof layOutXlsxSheet>, row: number, column: number) {
  return layout.data[row][column] as CellObject;
}

describe('layOutXlsxSheet', () => {
  it('keeps every value and the grid shape untouched', () => {
    const layout = layOutXlsxSheet([
      ['نام', 'وزن'],
      ['مس', 1.5],
      ['', 0],
    ]);

    expect(layout.data.map((row) => row.map((cell) => (cell as CellObject).value))).toEqual([
      ['نام', 'وزن'],
      ['مس', 1.5],
      ['', 0],
    ]);
  });

  it('sizes each column to its longest value, header included, plus padding', () => {
    const layout = layOutXlsxSheet([
      ['شماره', 'یک عنوان بسیار بلندتر از مقدار'],
      ['۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷', 'کوتاه'],
    ]);

    expect(layout.columns).toHaveLength(2);
    expect(layout.columns[0].width).toBe('۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷'.length + 2);
    expect(layout.columns[1].width).toBeGreaterThanOrEqual('یک عنوان بسیار بلندتر از مقدار'.length);
  });

  it('counts wide glyphs double', () => {
    const narrow = layOutXlsxSheet([['abcdefghij']]).columns[0].width;
    const wide = layOutXlsxSheet([['漢字漢字漢字漢字漢字']]).columns[0].width;

    expect(wide).toBeGreaterThan(narrow);
  });

  it('caps a very long value and wraps it onto a taller row', () => {
    const layout = layOutXlsxSheet([['عنوان'], ['ا'.repeat(200)]]);

    expect(layout.columns[0].width).toBe(60);
    expect(cellAt(layout, 1, 0).wrap).toBe(true);
    expect(cellAt(layout, 1, 0).height).toBeGreaterThan(15);
    expect(cellAt(layout, 0, 0).height).toBeUndefined();
  });

  it('puts a thin solid border on every cell of the range and pads short rows', () => {
    const layout = layOutXlsxSheet([['الف', 'ب'], ['x']]);

    expect(layout.data.every((row) => row.length === 2)).toBe(true);
    for (const row of layout.data) {
      for (const cell of row) {
        expect((cell as CellObject).borderStyle).toBe('thin');
      }
    }
  });

  it('makes the header row bold on a light grey fill and leaves data rows plain', () => {
    const layout = layOutXlsxSheet([['الف'], ['۱']]);

    expect(cellAt(layout, 0, 0).fontWeight).toBe('bold');
    expect(cellAt(layout, 0, 0).backgroundColor).toBeDefined();
    expect(cellAt(layout, 1, 0).fontWeight).toBeUndefined();
    expect(cellAt(layout, 1, 0).backgroundColor).toBeUndefined();
  });

  it('adds no column or row beyond the data', () => {
    const layout = layOutXlsxSheet([['a', 'b', 'c']]);

    expect(layout.data).toHaveLength(1);
    expect(layout.columns).toHaveLength(3);
  });
});
