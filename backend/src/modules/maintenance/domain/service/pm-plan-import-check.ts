import { toAsciiDigits } from '@framework/domain';

import { Equipment } from '../equipment.aggregate';
import { MaintenanceActivity } from '../maintenance-activity.aggregate';
import { CalendarDate } from '../value/calendar-date.vo';
import { EquipmentName } from '../value/equipment-name.vo';
import { IntervalDays } from '../value/interval-days.vo';
import {
  calendarDateFromJalaliText,
  jalaliTextOf,
} from '../value/jalali-date-text';
import { MaintenanceActivityName } from '../value/maintenance-activity-name.vo';

/** One cell as a spreadsheet hands it over; `null` when empty. */
export type PmPlanSheetCell = string | number | boolean | Date | null;

export const PM_PLAN_IMPORT_ERROR_REASONS = [
  'equipment-not-found',
  'activity-not-found',
  'equipment-retired',
  'duplicate-equipment-in-file',
  'duplicate-activity-in-file',
  'first-due-date-required',
  'invalid-jalali-date',
  'interval-required',
  'interval-not-positive-integer',
  'invalid-mark',
  'equipment-name-required',
  'activity-name-required',
] as const;

export type PmPlanImportErrorReason =
  (typeof PM_PLAN_IMPORT_ERROR_REASONS)[number];

/** What is wrong with one cell of the sheet. */
export interface PmPlanImportError {
  /** `D1` — the column's letters, then the spreadsheet row number. */
  readonly cell: string;
  readonly row: number;
  readonly column: string;
  /** The cell as text, trimmed; `''` when empty. */
  readonly value: string;
  readonly reason: PmPlanImportErrorReason;
}

/** A valid `+`: this activity, in this equipment's plan, from this date. */
export interface PmPlanImportItem {
  /** The crossing holding the `+`. */
  readonly cell: string;
  readonly equipment: Equipment;
  readonly activity: MaintenanceActivity;
  readonly intervalDays: IntervalDays;
  readonly firstDueDate: CalendarDate;
}

export type PmPlanImportDifference = 'intervalDays' | 'firstDueDate';

/** A valid `+` whose activity is already active in the plan, differently. */
export interface PmPlanImportConflict extends PmPlanImportItem {
  readonly existingIntervalDays: IntervalDays;
  readonly existingFirstDueDate: CalendarDate;
  /** In this order, only those that differ. */
  readonly differences: readonly PmPlanImportDifference[];
}

const NAME_ROW = 0;
const INTERVAL_ROW = 1;
const FIRST_EQUIPMENT_ROW = 2;
const NAME_COLUMN = 0;
const FIRST_DUE_DATE_COLUMN = 1;
const FIRST_ACTIVITY_COLUMN = 2;
const MARK = '+';
const DIGITS_ONLY = /^\d+$/;

interface LocatedError {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly error: PmPlanImportError;
}

/** An activity column whose name and interval are both valid. */
interface ActivityColumn {
  readonly activity: MaintenanceActivity;
  readonly intervalDays: IntervalDays;
}

/** An equipment row whose name and first due date are both valid. */
interface EquipmentRow {
  readonly equipment: Equipment;
  readonly firstDueDate: CalendarDate;
}

/**
 * The plant's PM matrix checked against the registered equipment, the
 * activity catalog and the plans in force (issue #127). The grid is the
 * sheet's cells, `cells[i]` spreadsheet row `i + 1`: equipment names down
 * column A from row 3, each row's first due date (Jalali text) in column B,
 * activity names across row 1 from column C, each activity's interval in
 * days in row 2, and a `+` at a crossing meaning "this activity is in this
 * equipment's plan". The activity columns run to the last column with
 * anything in rows 1–2 or at a crossing; the equipment rows to the last row
 * with anything in it.
 *
 * Every error is found at once, in file order (row, then column). A valid
 * `+` — its row and column both valid — is an item `toCreate` when no active
 * item of its activity is in the plan, `alreadyExisting` when the active one
 * has the same current interval and first due date, and a `conflicts` entry
 * otherwise; a conflict is reported, never applied.
 */
export class PmPlanImportCheck {
  private constructor(
    readonly errors: readonly PmPlanImportError[],
    readonly toCreate: readonly PmPlanImportItem[],
    readonly alreadyExisting: readonly PmPlanImportItem[],
    readonly conflicts: readonly PmPlanImportConflict[],
  ) {}

  static of(
    cells: readonly (readonly PmPlanSheetCell[])[],
    equipment: readonly Equipment[],
    activities: readonly MaintenanceActivity[],
  ): PmPlanImportCheck {
    const { errors, toCreate, alreadyExisting, conflicts } = new SheetCheck(
      cells,
      equipment,
      activities,
    ).run();
    return new PmPlanImportCheck(errors, toCreate, alreadyExisting, conflicts);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}

/** One run of the check over one grid. */
class SheetCheck {
  private readonly located: LocatedError[] = [];
  private readonly equipmentByName: ReadonlyMap<string, Equipment>;
  private readonly activityByName: ReadonlyMap<string, MaintenanceActivity>;
  private readonly lastRow: number;
  private readonly lastColumn: number;

  constructor(
    private readonly cells: readonly (readonly PmPlanSheetCell[])[],
    equipment: readonly Equipment[],
    activities: readonly MaintenanceActivity[],
  ) {
    this.equipmentByName = new Map(
      equipment.map((item) => [item.name().asString(), item]),
    );
    this.activityByName = new Map(
      activities.map((item) => [item.name().asString(), item]),
    );
    this.lastRow = this.findLastRow();
    this.lastColumn = this.findLastColumn();
  }

  run(): {
    errors: PmPlanImportError[];
    toCreate: PmPlanImportItem[];
    alreadyExisting: PmPlanImportItem[];
    conflicts: PmPlanImportConflict[];
  } {
    const marks = this.readMarks();
    const columnsWithMark = new Set(marks.map(({ column }) => column));
    const rowsWithMark = new Set(marks.map(({ row }) => row));
    const columns = this.readActivityColumns(columnsWithMark);
    const rows = this.readEquipmentRows(rowsWithMark);

    const toCreate: PmPlanImportItem[] = [];
    const alreadyExisting: PmPlanImportItem[] = [];
    const conflicts: PmPlanImportConflict[] = [];
    for (const mark of marks) {
      const column = columns.get(mark.column);
      const row = rows.get(mark.row);
      if (!column || !row) continue;
      const item: PmPlanImportItem = {
        cell: addressOf(mark.row, mark.column),
        equipment: row.equipment,
        activity: column.activity,
        intervalDays: column.intervalDays,
        firstDueDate: row.firstDueDate,
      };
      const active = row.equipment.activePlanItemFor(column.activity.id);
      if (!active) {
        toCreate.push(item);
        continue;
      }
      const existingIntervalDays = active.schedule().intervalDays();
      const existingFirstDueDate = active.schedule().firstDueDate();
      const differences: PmPlanImportDifference[] = [];
      if (!existingIntervalDays.equals(item.intervalDays)) {
        differences.push('intervalDays');
      }
      if (!existingFirstDueDate.equals(item.firstDueDate)) {
        differences.push('firstDueDate');
      }
      if (differences.length === 0) {
        alreadyExisting.push(item);
      } else {
        conflicts.push({
          ...item,
          existingIntervalDays,
          existingFirstDueDate,
          differences,
        });
      }
    }

    return {
      errors: this.errorsInFileOrder(),
      toCreate,
      alreadyExisting,
      conflicts,
    };
  }

  /** Every `+` at a crossing, in file order; any other mark is an error. */
  private readMarks(): { row: number; column: number }[] {
    const marks: { row: number; column: number }[] = [];
    for (let row = FIRST_EQUIPMENT_ROW; row <= this.lastRow; row++) {
      for (
        let column = FIRST_ACTIVITY_COLUMN;
        column <= this.lastColumn;
        column++
      ) {
        const text = this.textAt(row, column);
        if (text === MARK) {
          marks.push({ row, column });
        } else if (text !== '') {
          this.report(row, column, text, 'invalid-mark');
        }
      }
    }
    return marks;
  }

  private readActivityColumns(
    columnsWithMark: ReadonlySet<number>,
  ): Map<number, ActivityColumn> {
    const indices: number[] = [];
    for (
      let column = FIRST_ACTIVITY_COLUMN;
      column <= this.lastColumn;
      column++
    ) {
      indices.push(column);
    }
    const names = this.namesAt(
      indices.map((column) => [NAME_ROW, column]),
      activityNameKey,
    );

    const columns = new Map<number, ActivityColumn>();
    for (const column of indices) {
      const hasMark = columnsWithMark.has(column);
      const activity = this.namedRecord(
        NAME_ROW,
        column,
        names,
        this.activityByName,
        activityNameKey,
        hasMark,
        {
          required: 'activity-name-required',
          notFound: 'activity-not-found',
          duplicate: 'duplicate-activity-in-file',
        },
      );
      const intervalDays = this.intervalAt(column, hasMark);
      if (activity && intervalDays) {
        columns.set(column, { activity, intervalDays });
      }
    }
    return columns;
  }

  private readEquipmentRows(
    rowsWithMark: ReadonlySet<number>,
  ): Map<number, EquipmentRow> {
    const indices: number[] = [];
    for (let row = FIRST_EQUIPMENT_ROW; row <= this.lastRow; row++) {
      indices.push(row);
    }
    const names = this.namesAt(
      indices.map((row) => [row, NAME_COLUMN]),
      equipmentNameKey,
    );

    const rows = new Map<number, EquipmentRow>();
    for (const row of indices) {
      const hasMark = rowsWithMark.has(row);
      let equipment = this.namedRecord(
        row,
        NAME_COLUMN,
        names,
        this.equipmentByName,
        equipmentNameKey,
        hasMark,
        {
          required: 'equipment-name-required',
          notFound: 'equipment-not-found',
          duplicate: 'duplicate-equipment-in-file',
        },
      );
      if (equipment && hasMark && equipment.isRetired()) {
        this.report(
          row,
          NAME_COLUMN,
          this.textAt(row, NAME_COLUMN),
          'equipment-retired',
        );
        equipment = null;
      }
      const firstDueDate = this.firstDueDateAt(row, hasMark);
      if (equipment && firstDueDate) {
        rows.set(row, { equipment, firstDueDate });
      }
    }
    return rows;
  }

  /**
   * The record a name cell names, or `null` with the cell's error: an empty
   * name is an error only where a `+` needs it; an unknown name always; a
   * name held by more than one cell on every cell holding it. Names are
   * compared as the record type's name value object reads them (`keyOf`).
   */
  private namedRecord<T>(
    row: number,
    column: number,
    nameCounts: ReadonlyMap<string, number>,
    registered: ReadonlyMap<string, T>,
    keyOf: (name: string) => string,
    hasMark: boolean,
    reasons: {
      required: PmPlanImportErrorReason;
      notFound: PmPlanImportErrorReason;
      duplicate: PmPlanImportErrorReason;
    },
  ): T | null {
    const text = this.textAt(row, column);
    if (text === '') {
      if (hasMark) this.report(row, column, text, reasons.required);
      return null;
    }
    const key = keyOf(text);
    const record = registered.get(key);
    if (!record) {
      this.report(row, column, text, reasons.notFound);
      return null;
    }
    if ((nameCounts.get(key) ?? 0) > 1) {
      this.report(row, column, text, reasons.duplicate);
      return null;
    }
    return record;
  }

  private intervalAt(column: number, hasMark: boolean): IntervalDays | null {
    const text = this.textAt(INTERVAL_ROW, column);
    if (text === '') {
      if (hasMark) {
        this.report(INTERVAL_ROW, column, text, 'interval-required');
      }
      return null;
    }
    // Only plain digits are a number of days here: `1e2`, `+30` or `30.0`
    // written as text is refused, whatever `Number()` would make of it.
    const digits = toAsciiDigits(text);
    const interval = IntervalDays.tryOf(
      DIGITS_ONLY.test(digits) ? Number(digits) : Number.NaN,
    );
    if (!interval) {
      this.report(INTERVAL_ROW, column, text, 'interval-not-positive-integer');
    }
    return interval;
  }

  private firstDueDateAt(row: number, hasMark: boolean): CalendarDate | null {
    const text = this.textAt(row, FIRST_DUE_DATE_COLUMN);
    if (text === '') {
      if (hasMark) {
        this.report(
          row,
          FIRST_DUE_DATE_COLUMN,
          text,
          'first-due-date-required',
        );
      }
      return null;
    }
    const date = calendarDateFromJalaliText(text);
    if (!date) {
      this.report(row, FIRST_DUE_DATE_COLUMN, text, 'invalid-jalali-date');
    }
    return date;
  }

  /** How many of these cells hold each (non-empty) name. */
  private namesAt(
    positions: [number, number][],
    keyOf: (name: string) => string,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const [row, column] of positions) {
      const text = this.textAt(row, column);
      if (text === '') continue;
      const key = keyOf(text);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  private findLastRow(): number {
    for (let row = this.cells.length - 1; row >= FIRST_EQUIPMENT_ROW; row--) {
      const cellsOfRow = this.cells[row] ?? [];
      if (cellsOfRow.some((_, column) => this.textAt(row, column) !== '')) {
        return row;
      }
    }
    return FIRST_EQUIPMENT_ROW - 1;
  }

  private findLastColumn(): number {
    let last = FIRST_ACTIVITY_COLUMN - 1;
    for (const [row, cellsOfRow] of this.cells.entries()) {
      for (
        let column = cellsOfRow.length - 1;
        column > last && column >= FIRST_ACTIVITY_COLUMN;
        column--
      ) {
        if (this.textAt(row, column) !== '') {
          last = column;
          break;
        }
      }
    }
    return last;
  }

  private textAt(row: number, column: number): string {
    return textOf(this.cells[row]?.[column]);
  }

  private report(
    rowIndex: number,
    columnIndex: number,
    value: string,
    reason: PmPlanImportErrorReason,
  ): void {
    this.located.push({
      rowIndex,
      columnIndex,
      error: {
        cell: addressOf(rowIndex, columnIndex),
        row: rowIndex + 1,
        column: columnLetters(columnIndex),
        value,
        reason,
      },
    });
  }

  private errorsInFileOrder(): PmPlanImportError[] {
    return this.located
      .toSorted(
        (a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex,
      )
      .map(({ error }) => error);
  }
}

/** A non-empty equipment name cell as `EquipmentName` stores it. */
function equipmentNameKey(name: string): string {
  return EquipmentName.fromString(name).asString();
}

/** A non-empty activity name cell as `MaintenanceActivityName` stores it. */
function activityNameKey(name: string): string {
  return MaintenanceActivityName.fromString(name).asString();
}

/** A cell as the text it shows, trimmed; a date cell as Jalali text. */
function textOf(cell: PmPlanSheetCell | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return jalaliTextOf(cell);
  return String(cell).trim();
}

function addressOf(rowIndex: number, columnIndex: number): string {
  return `${columnLetters(columnIndex)}${rowIndex + 1}`;
}

/** `0` → `A`, `25` → `Z`, `26` → `AA`. */
function columnLetters(columnIndex: number): string {
  let letters = '';
  for (let n = columnIndex + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCodePoint(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}
