import writeExcelFile, { Row } from 'write-excel-file/node';
import { theMaintenanceTaskNamed } from './maintenance-records';
import { UNSTATED_FIRST_DUE_DATE, UNSTATED_INTERVAL_DAYS } from './pm-plan';

/**
 * Test data for `importing-pm-plans.feature` (issue #127): a real `.xlsx` shaped like the plant's PM
 * matrix (`docs/superpowers/specs/2026-11-19-pm-plan-import-design.md`). One sheet named `pm`:
 *
 * | row | A        | B           | C, D, …                     |
 * | --- | -------- | ----------- | --------------------------- |
 * | 1   | «تجهیز»  | «اولین موعد» | each activity's name        |
 * | 2   | (empty)  | (empty)     | each activity's interval    |
 * | 3+  | equipment | its first due date (Jalali text) | `+` where the activity is in its plan |
 *
 * The Gherkin writes the first two rows as one header — «تعویض روغن (30 روز)» — and the rows from
 * spreadsheet row 3 on as its own rows, so a Gherkin cell address («D1», «A4», «C3») means the cell
 * it names here. An empty Gherkin cell is an empty spreadsheet cell.
 *
 * Every cell is written as text, as the Gherkin types it — «1405/10/1», «سی», «x» must reach the
 * system exactly as written, since reading them is the rule under test — except an interval made
 * only of Latin digits, which is written as a number, as a real spreadsheet holds one.
 */

export const PM_PLAN_EXCEL_FILE_NAME = 'pm.xlsx';
export const PM_PLAN_EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PM_PLAN_SHEET_NAME = 'pm';

const EQUIPMENT_HEADER = 'تجهیز';
const FIRST_DUE_DATE_HEADER = 'اولین موعد';
const MARK = '+';

/** «تعویض روغن (30 روز)» → name «تعویض روغن», interval «30». */
const ACTIVITY_HEADER = /^(.+?)\s*\(\s*([^()]*?)\s*روز\s*\)$/;

/** The grid of a PM-plan workbook, row by row, each cell as text (`''` = empty). Immutable. */
export class PmPlanSheet {
  constructor(readonly grid: readonly (readonly string[])[]) {}

  /** The same sheet with the cell at `address` («B3», «C2») holding `value`. */
  withCell(address: string, value: string): PmPlanSheet {
    const { row, column } = cellAt(address);
    const grid = this.grid.map((cells) => [...cells]);
    while (grid.length <= row) {
      grid.push([]);
    }
    while (grid[row].length <= column) {
      grid[row].push('');
    }
    grid[row][column] = value;
    return new PmPlanSheet(grid);
  }

  /** The activity names across row 1, from column C on. */
  activityNames(): string[] {
    return (this.grid[0] ?? []).slice(2);
  }

  /** The equipment names down column A, from row 3 on. */
  equipmentNames(): string[] {
    return this.grid.slice(2).map((cells) => cells[0] ?? '');
  }
}

/** «C2» → zero-based row 1, column 2. */
const cellAt = (address: string): { row: number; column: number } => {
  const match = /^([A-Z]+)(\d+)$/.exec(address.trim().toUpperCase());
  if (!match) {
    throw new Error(`"${address}" is not a cell address like «B3».`);
  }
  const column = [...match[1]].reduce(
    (index, letter) => index * 26 + (letter.charCodeAt(0) - 64),
    0,
  );
  return { row: Number(match[2]) - 1, column: column - 1 };
};

const splitActivityHeader = (
  header: string,
): { name: string; intervalDays: string } => {
  const match = ACTIVITY_HEADER.exec(header.trim());
  if (!match) {
    throw new Error(
      `The activity header "${header}" does not read «<name> (<days> روز)».`,
    );
  }
  return { name: match[1], intervalDays: match[2] };
};

/**
 * The sheet a Gherkin table describes — its header «تجهیز | اولین موعد | تعویض روغن (30 روز) | …»
 * becomes rows 1 and 2, its body rows the rows from 3 on.
 */
export const pmPlanSheetFrom = (gherkin: string[][]): PmPlanSheet => {
  const [header, ...rows] = gherkin;
  if (
    !header ||
    header[0] !== EQUIPMENT_HEADER ||
    header[1] !== FIRST_DUE_DATE_HEADER
  ) {
    throw new Error(
      `A PM plan table starts «${EQUIPMENT_HEADER} | ${FIRST_DUE_DATE_HEADER} | …», not «${(header ?? []).join(' | ')}».`,
    );
  }
  const activities = header.slice(2).map(splitActivityHeader);
  return new PmPlanSheet([
    [
      EQUIPMENT_HEADER,
      FIRST_DUE_DATE_HEADER,
      ...activities.map(({ name }) => name),
    ],
    ['', '', ...activities.map(({ intervalDays }) => intervalDays)],
    ...rows.map((cells) => cells.map((cell) => cell.trim())),
  ]);
};

/** One equipment, one activity, one `+` — a sheet with nothing wrong in it. */
const oneMarkSheet = (
  equipmentName: string,
  activityName: string,
  intervalDays: string,
  firstDueDate: string,
): PmPlanSheet =>
  new PmPlanSheet([
    [EQUIPMENT_HEADER, FIRST_DUE_DATE_HEADER, activityName],
    ['', '', intervalDays],
    [equipmentName, firstDueDate, MARK],
  ]);

/**
 * The valid sheet the «… که <خانه> آن "<مقدار>" است» outline overrides one cell of: «کمپرسور هوا»
 * (A3) due first «1405/08/30» (B3), «تعویض روغن» (C1) every 30 days (C2), marked (C3) — all from the
 * feature's background.
 */
export const aValidPmPlanSheet = (): PmPlanSheet =>
  oneMarkSheet('کمپرسور هوا', 'تعویض روغن', '30', '1405/08/30');

/**
 * «… که تعویض روغن کمپرسور هوا را دارد» — the one `+` of that activity on that equipment, with an
 * interval and a first due date the Gherkin leaves unstated.
 */
export const aPmPlanSheetHolding = (maintenanceTask: string): PmPlanSheet => {
  const { equipmentName, activityName } =
    theMaintenanceTaskNamed(maintenanceTask);
  return oneMarkSheet(
    equipmentName,
    activityName,
    UNSTATED_INTERVAL_DAYS,
    UNSTATED_FIRST_DUE_DATE,
  );
};

/**
 * «… که فعالیت "روغن کاری" آن تعریف نشده است» — the valid sheet with a second, marked column for an
 * activity the system does not know.
 */
export const aPmPlanSheetWithTheUndefinedActivity = (
  activityName: string,
): PmPlanSheet =>
  aValidPmPlanSheet()
    .withCell('D1', activityName)
    .withCell('D2', '7')
    .withCell('D3', MARK);

const INTERVAL_ROW = 1;

const cellOf = (value: string, row: number) => {
  if (value === '') {
    return null;
  }
  if (row === INTERVAL_ROW && /^[0-9]+$/.test(value)) {
    return { value: Number(value), type: Number };
  }
  return { value, type: String };
};

/** The `.xlsx` file's bytes. */
export const pmPlanExcelFile = (sheet: PmPlanSheet): Promise<Buffer> => {
  const width = Math.max(...sheet.grid.map((cells) => cells.length));
  const rows: Row[] = sheet.grid.map((cells, row) =>
    Array.from({ length: width }, (_, column) =>
      cellOf(cells[column] ?? '', row),
    ),
  );
  return writeExcelFile(rows, { sheet: PM_PLAN_SHEET_NAME }).toBuffer();
};
