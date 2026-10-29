import { Injectable } from '@nestjs/common';
import { MaterialImportFileUnreadable } from '@products/application/exceptions';
import { SheetCell } from '@products/application/service/material-import-sheet';
import { MaterialImportSheetReader } from '@products/application/service/material-import-sheet-reader';
import readExcelFile from 'read-excel-file/node';

/**
 * `MaterialImportSheetReader` over `read-excel-file`: the first sheet's
 * cells, one array per spreadsheet row. The library addresses cells by their
 * reference, so blank rows above the header (the accounting export leaves
 * row 1 empty) come through as rows of `null`, keeping Excel's numbering.
 * Anything it can't open as `.xlsx` is `MaterialImportFileUnreadable`.
 */
@Injectable()
export class XlsxMaterialImportSheetReader extends MaterialImportSheetReader {
  async readFirstSheet(file: Buffer): Promise<SheetCell[][]> {
    try {
      const [firstSheet] = await readExcelFile(file);
      return (firstSheet?.data ?? []) as SheetCell[][];
    } catch {
      throw MaterialImportFileUnreadable.notASpreadsheet();
    }
  }
}
