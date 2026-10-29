import { ApplicationException } from '@framework/application';

// Thrown when an uploaded file can't be read as the accounting software's
// item list: it is not a readable `.xlsx`, or no row of its first sheet holds
// both the «کد کالا» and «نام کالا» headers. A 400: the upload itself is the
// problem.
export class MaterialImportFileUnreadable extends ApplicationException {
  public static notASpreadsheet(): MaterialImportFileUnreadable {
    return new MaterialImportFileUnreadable(
      'The uploaded file is not a readable .xlsx spreadsheet',
    );
  }

  public static missing(): MaterialImportFileUnreadable {
    return new MaterialImportFileUnreadable(
      'No file was uploaded in the "file" field',
    );
  }

  public static withoutHeaderRow(): MaterialImportFileUnreadable {
    return new MaterialImportFileUnreadable(
      'No row of the spreadsheet holds both the «کد کالا» and «نام کالا» headers',
    );
  }
}
