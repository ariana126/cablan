import { layOutXlsxSheet } from './xlsx-sheet-layout';

describe('layOutXlsxSheet', () => {
  it('keeps every value and the grid shape untouched', () => {
    const sut = layOutXlsxSheet([
      ['نام', 'وزن'],
      ['مس', 1.5],
      ['', 0],
    ]);

    expect(sut.data.map((row) => row.map((cell) => cell.value))).toEqual([
      ['نام', 'وزن'],
      ['مس', 1.5],
      ['', 0],
    ]);
  });

  it('sizes each column to its longest value, header included, plus padding', () => {
    const sut = layOutXlsxSheet([
      ['شماره', 'یک عنوان بسیار بلندتر از مقدار'],
      ['۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷', 'کوتاه'],
    ]);

    // 17 digits + 2 padding; the bold 30-character header is 30 × 1.15 → 35, + 2.
    expect(sut.columns).toEqual([{ width: 19 }, { width: 37 }]);
  });

  it('never makes a column narrower than eight characters', () => {
    const sut = layOutXlsxSheet([['a'], ['b']]);

    expect(sut.columns).toEqual([{ width: 8 }]);
  });

  it('counts wide glyphs double and invisible marks not at all', () => {
    const narrow = layOutXlsxSheet([['abcdefghij']]).columns[0].width;
    const wide = layOutXlsxSheet([['漢字漢字漢字漢字漢字']]).columns[0].width;
    const withZeroWidthJoiners = layOutXlsxSheet([['ab‌cd‌ef‌gh‌ij']])
      .columns[0].width;

    expect(wide).toBeGreaterThan(narrow);
    expect(withZeroWidthJoiners).toBe(narrow);
  });

  it('measures a multi-line value by its longest line', () => {
    const sut = layOutXlsxSheet([['x'], ['abcdefghijkl\nab']]);

    expect(sut.columns).toEqual([{ width: 14 }]);
    expect(sut.data[1][0].height).toBe(30);
  });

  it('caps a very long value and wraps it onto a taller row', () => {
    const sut = layOutXlsxSheet([['عنوان'], ['ا'.repeat(200)]]);

    expect(sut.columns[0].width).toBe(60);
    expect(sut.data[1][0].wrap).toBe(true);
    // 200 characters over 58 usable per line → 4 lines of 15pt.
    expect(sut.data[1][0].height).toBe(60);
    expect(sut.data[0][0].height).toBeUndefined();
  });

  it('puts a thin black border on every cell of the range and pads short rows', () => {
    const sut = layOutXlsxSheet([['الف', 'ب'], ['x']]);

    expect(sut.data.every((row) => row.length === 2)).toBe(true);
    expect(sut.data[1][1].value).toBe('');
    for (const row of sut.data) {
      for (const cell of row) {
        expect(cell.borderStyle).toBe('thin');
        expect(cell.borderColor).toBe('#000000');
      }
    }
  });

  it('makes the header row bold on a light grey fill and leaves data rows plain', () => {
    const sut = layOutXlsxSheet([['الف'], ['۱']]);

    expect(sut.data[0][0].fontWeight).toBe('bold');
    expect(sut.data[0][0].backgroundColor).toBe('#F2F2F2');
    expect(sut.data[1][0].fontWeight).toBeUndefined();
    expect(sut.data[1][0].backgroundColor).toBeUndefined();
  });

  it('adds no column or row beyond the data', () => {
    const sut = layOutXlsxSheet([['a', 'b', 'c']]);

    expect(sut.data).toHaveLength(1);
    expect(sut.columns).toHaveLength(3);
  });
});
