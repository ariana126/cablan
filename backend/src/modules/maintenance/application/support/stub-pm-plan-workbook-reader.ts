import { PmPlanImportFileUnreadable } from '@maintenance/application/exceptions';
import {
  PmPlanWorkbookReader,
  PmPlanWorkbookSheet,
} from '@maintenance/application/service/pm-plan-workbook-reader';

// Hands back the sheets it was given for any file, or refuses every file as
// unreadable (`unreadable()`).
export class StubPmPlanWorkbookReader extends PmPlanWorkbookReader {
  private constructor(
    private readonly sheets: readonly PmPlanWorkbookSheet[] | null,
  ) {
    super();
  }

  static holding(...sheets: PmPlanWorkbookSheet[]): StubPmPlanWorkbookReader {
    return new StubPmPlanWorkbookReader(sheets);
  }

  static unreadable(): StubPmPlanWorkbookReader {
    return new StubPmPlanWorkbookReader(null);
  }

  sheetsOf(): Promise<PmPlanWorkbookSheet[]> {
    if (!this.sheets) {
      return Promise.reject(PmPlanImportFileUnreadable.notASpreadsheet());
    }
    return Promise.resolve([...this.sheets]);
  }
}
