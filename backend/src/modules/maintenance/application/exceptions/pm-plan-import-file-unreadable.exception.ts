import { ApplicationException } from '@framework/application';

/** Why the upload could not be read: one problem type, a detail per reason. */
export type PmPlanImportFileUnreadableReason =
  | 'missing'
  | 'not-a-spreadsheet'
  | 'without-sheets';

// Thrown when an upload can't be read as a PM plan workbook: no file, a file
// that is not a readable `.xlsx`, or a workbook without a sheet. A 400
// `pm-plan-import-file-unreadable`: the upload itself is the problem.
export class PmPlanImportFileUnreadable extends ApplicationException {
  private constructor(
    message: string,
    public readonly reason: PmPlanImportFileUnreadableReason,
  ) {
    super(message);
  }

  public static notASpreadsheet(): PmPlanImportFileUnreadable {
    return new PmPlanImportFileUnreadable(
      'The uploaded file is not a readable .xlsx spreadsheet',
      'not-a-spreadsheet',
    );
  }

  public static missing(): PmPlanImportFileUnreadable {
    return new PmPlanImportFileUnreadable(
      'No file was uploaded in the "file" field',
      'missing',
    );
  }

  public static withoutSheets(): PmPlanImportFileUnreadable {
    return new PmPlanImportFileUnreadable(
      'The workbook holds no sheet',
      'without-sheets',
    );
  }
}
