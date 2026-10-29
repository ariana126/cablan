import writeExcelFile, { Row } from 'write-excel-file/node';

/**
 * Test data for `importing-materials.feature`: a real `.xlsx` shaped like the item list the
 * accounting software exports (`docs/superpowers/specs/2026-10-29-importing-materials-design.md`,
 * «The file»). One sheet; row 1 blank; row 2 the header «ردیف | نوع | کد کالا | نام کالا | واحد»;
 * one item per row from row 3 on. The system reads only «کد کالا» and «نام کالا» and reports each
 * item by its spreadsheet row number, so the other three columns carry plausible filler.
 *
 * Codes are written as text cells, as the accounting export writes them — a Gherkin «M-۱۰۱» must
 * reach the system exactly as typed, Persian digits included, since normalising them is the rule
 * under test.
 */

/** One item as a Gherkin row states it. `''` is an empty cell. */
export interface AccountingExcelItem {
  name: string;
  code: string;
}

/** An item with the spreadsheet row number the system will report it by. */
export interface AccountingExcelRow extends AccountingExcelItem {
  row: number;
}

const HEADER = ['ردیف', 'نوع', 'کد کالا', 'نام کالا', 'واحد'];
const COLUMN_COUNT = HEADER.length;

/** Row 1 is blank and row 2 the header, so the first item sits on spreadsheet row 3. */
export const FIRST_DATA_ROW = 3;

export const ACCOUNTING_EXCEL_FILE_NAME = 'kala.xlsx';
export const ACCOUNTING_EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The items, numbered by the spreadsheet row each one lands on. */
export const numberedAsInTheSpreadsheet = (
  items: AccountingExcelItem[],
): AccountingExcelRow[] =>
  items.map((item, index) => ({ ...item, row: FIRST_DATA_ROW + index }));

const textCell = (value: string) =>
  value === '' ? null : { value, type: String };

const itemRow = (item: AccountingExcelItem, index: number): Row => [
  index + 1,
  'کالا',
  textCell(item.code),
  textCell(item.name),
  'کیلوگرم',
];

/** The `.xlsx` file's bytes. */
export const accountingExcelFile = (
  items: AccountingExcelItem[],
): Promise<Buffer> =>
  writeExcelFile([
    Array<null>(COLUMN_COUNT).fill(null),
    HEADER,
    ...items.map(itemRow),
  ]).toBuffer();
