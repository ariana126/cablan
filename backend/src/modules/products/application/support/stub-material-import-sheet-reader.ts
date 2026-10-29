import { MaterialImportFileUnreadable } from '@products/application/exceptions';
import { SheetCell } from '@products/application/service/material-import-sheet';
import { MaterialImportSheetReader } from '@products/application/service/material-import-sheet-reader';

// A stub: answers with the cells it was given for any file, or refuses every
// file as not a spreadsheet — the two outcomes the real reader has.
export class StubMaterialImportSheetReader extends MaterialImportSheetReader {
  private constructor(private readonly cells: SheetCell[][] | null) {
    super();
  }

  static holding(cells: SheetCell[][]): StubMaterialImportSheetReader {
    return new StubMaterialImportSheetReader(cells);
  }

  static unreadable(): StubMaterialImportSheetReader {
    return new StubMaterialImportSheetReader(null);
  }

  readFirstSheet(): Promise<SheetCell[][]> {
    if (this.cells === null) {
      return Promise.reject(MaterialImportFileUnreadable.notASpreadsheet());
    }
    return Promise.resolve(this.cells);
  }
}
