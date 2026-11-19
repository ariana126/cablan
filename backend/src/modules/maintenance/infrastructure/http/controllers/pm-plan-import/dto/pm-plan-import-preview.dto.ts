import { PM_PLAN_IMPORT_ERROR_REASONS } from '@maintenance/domain/service/pm-plan-import-check';
import { ApiProperty } from '@nestjs/swagger';

const DIFFERENCES = ['intervalDays', 'firstDueDate'];

// Response documentation only: the controller returns the read model, whose
// shape these classes describe as the named `PmPlanImportPreview` schemas.

export class PmPlanImportError {
  /** The sheet the file was read from. */
  @ApiProperty({ example: 'pm' })
  sheet: string;

  /** The column's letters, then the spreadsheet row number. */
  @ApiProperty({ example: 'D1' })
  cell: string;

  @ApiProperty({ example: 1 })
  row: number;

  @ApiProperty({ example: 'D' })
  column: string;

  /** The cell as text, trimmed; `''` when empty. */
  @ApiProperty({ example: 'روغن کاری' })
  value: string;

  @ApiProperty({
    enum: PM_PLAN_IMPORT_ERROR_REASONS,
    example: 'activity-not-found',
  })
  reason: string;

  /** The reason as the user reads it. */
  @ApiProperty({ example: 'فعالیت تعریف نشده است' })
  message: string;
}

export class PmPlanImportItem {
  /** The crossing holding the `+`. */
  @ApiProperty({ example: 'C3' })
  cell: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  equipmentId: string;

  @ApiProperty({ example: 'کمپرسور هوا' })
  equipmentName: string;

  @ApiProperty({ example: '6ba7b810-9dad-41d1-80b4-00c04fd430c8' })
  activityId: string;

  @ApiProperty({ example: 'تعویض روغن' })
  activityName: string;

  /** The interval of the activity's column. */
  @ApiProperty({ example: 30 })
  intervalDays: number;

  /** The date of the equipment's row, ISO. */
  @ApiProperty({ example: '2026-11-21', format: 'date' })
  firstDueDate: string;
}

export class PmPlanImportConflict extends PmPlanImportItem {
  /** The active item's current interval. */
  @ApiProperty({ example: 15 })
  existingIntervalDays: number;

  @ApiProperty({ example: '2026-11-21', format: 'date' })
  existingFirstDueDate: string;

  /** What differs from the active item, in this order. */
  @ApiProperty({ enum: DIFFERENCES, isArray: true, example: ['intervalDays'] })
  differences: string[];
}

export class PmPlanImportCounts {
  @ApiProperty({ example: 2 })
  toCreate: number;

  @ApiProperty({ example: 0 })
  alreadyExisting: number;

  @ApiProperty({ example: 0 })
  conflicts: number;

  @ApiProperty({ example: 0 })
  errors: number;
}

export class PmPlanImportPreview {
  /** The sheet read: the one named `pm` (any case, trimmed), else the first. */
  @ApiProperty({ example: 'pm' })
  sheetName: string;

  @ApiProperty({ type: PmPlanImportCounts })
  counts: PmPlanImportCounts;

  /** In file order: by row, then column. */
  @ApiProperty({ type: PmPlanImportError, isArray: true })
  errors: PmPlanImportError[];

  /** What confirming adds (or, after confirming, what was added). */
  @ApiProperty({ type: PmPlanImportItem, isArray: true })
  toCreate: PmPlanImportItem[];

  /** Already active with the same interval and first due date; left as is. */
  @ApiProperty({ type: PmPlanImportItem, isArray: true })
  alreadyExisting: PmPlanImportItem[];

  /** Active with another interval or first due date; reported, never applied. */
  @ApiProperty({ type: PmPlanImportConflict, isArray: true })
  conflicts: PmPlanImportConflict[];
}
