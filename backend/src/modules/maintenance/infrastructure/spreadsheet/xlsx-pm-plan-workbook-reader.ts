import { PmPlanImportFileUnreadable } from '@maintenance/application/exceptions';
import {
  PmPlanWorkbookReader,
  PmPlanWorkbookSheet,
} from '@maintenance/application/service/pm-plan-workbook-reader';
import { PmPlanSheetCell } from '@maintenance/domain/service/pm-plan-import-check';
import { Injectable } from '@nestjs/common';
import readExcelFile from 'read-excel-file/node';

/**
 * `PmPlanWorkbookReader` over `read-excel-file`: every sheet's name and
 * cells, one array per spreadsheet row. The library addresses cells by
 * their reference, so blank rows come through as rows of `null`, keeping
 * Excel's numbering; a date cell comes through as a `Date` (that day's UTC
 * midnight). Anything it can't open as `.xlsx` is
 * `PmPlanImportFileUnreadable`.
 */
@Injectable()
export class XlsxPmPlanWorkbookReader extends PmPlanWorkbookReader {
  async sheetsOf(file: Buffer): Promise<PmPlanWorkbookSheet[]> {
    try {
      const sheets = await readExcelFile(file);
      return sheets.map(({ sheet, data }) => ({
        name: sheet,
        cells: data as PmPlanSheetCell[][],
      }));
    } catch {
      throw PmPlanImportFileUnreadable.notASpreadsheet();
    }
  }
}
