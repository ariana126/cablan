import { PmPlanSheetCell } from '@maintenance/domain/service/pm-plan-import-check';

/** One sheet of an uploaded workbook: its name and its cells. */
export interface PmPlanWorkbookSheet {
  readonly name: string;
  /** `cells[i]` is spreadsheet row `i + 1` — blank rows kept, not dropped. */
  readonly cells: readonly (readonly PmPlanSheetCell[])[];
}

/**
 * The port for "what sheets does this uploaded workbook hold", in workbook
 * order. Throws `PmPlanImportFileUnreadable` when the file is not a readable
 * `.xlsx`. Bound in infrastructure.
 */
export abstract class PmPlanWorkbookReader {
  abstract sheetsOf(file: Buffer): Promise<PmPlanWorkbookSheet[]>;
}
