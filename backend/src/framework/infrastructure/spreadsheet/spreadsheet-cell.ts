/**
 * One cell of a plain export grid: text stays text, a number is written as a number. A grid is
 * header row first — every export shapes its rows into this before `renderXlsxWorkbook` writes it.
 */
export type SpreadsheetCell = string | number;

export type SpreadsheetGrid = SpreadsheetCell[][];
