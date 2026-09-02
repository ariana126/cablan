import { d, Task, Wait } from '@serenity-js/core';
import { Click, isVisible } from '@serenity-js/web';
import { StandardBomReportsPage } from '../ui/standard-bom-reports-page';
import { ViewStandardBomReportList } from './standard-bom-report-list';
import { CaptureTheDownloadTriggeredBy } from '../common/downloads';

/**
 * Domain layer for "خروجی اکسل آنالیز های استاندارد" (`exporting-standard-bom.feature`) — every
 * scenario is UI-voiced (an active "سینا ... خروجی اکسل می‌گیرد"), so every task here drives the
 * real report page's export control, never the API directly. `POST /standard-boms/report/export`
 * is API-internal per the dispatch this automation was written against — the frontend calls it,
 * this suite never does, mirroring `bom-report-export.ts`'s own reasoning for the daily-BOM export
 * (and `standard-bom-report-list.ts`'s own module comment, which gives the same reasoning for never
 * calling `POST /standard-boms/report` directly either).
 *
 * The workbook-grid assertions this feature's own `Then` steps need
 * (`EnsureExportedWorkbookIsExactly`/`EnsureExportedWorkbookOnlyContains`, both in
 * `bom-report-export.ts`) are generic over any downloaded grid — they never touch a Page Object, only
 * `screenplay/common/downloads.ts#TheDownloadedWorkbookGrid` — so `common.steps.ts` reuses that one
 * implementation for both features rather than duplicating it here under a "StandardBom" name. Only
 * the export TRIGGER differs (a different page, a different list-locating task), which is what this
 * module exists to provide, mirroring `ExportDailyBomReportList`'s own shape exactly.
 */

/** Opens the export menu and picks `format`, capturing the resulting download — see
 * `ui/standard-bom-reports-page.ts#exportButton`'s own comment for the ASSUMPTION this click
 * sequence rests on. */
const ExportInFormat = (format: string): Task =>
  Task.where(
    d`#actor exports the report list in format "${format}"`,
    Click.on(StandardBomReportsPage.exportButton()),
    Wait.until(
      StandardBomReportsPage.exportFormatMenuItem(format),
      isVisible(),
    ),
    CaptureTheDownloadTriggeredBy(
      StandardBomReportsPage.exportFormatMenuItem(format),
    ),
  );

export const ExportStandardBomReportList = {
  /** "سینا از لیست آنالیز های استاندارد با فرمت «...» خروجی اکسل می گیرد" — no preceding "لیست را
   * مشاهده می کند" step has located the page first, so this locates it itself
   * (`ViewStandardBomReportList.unfiltered()`), mirroring
   * `ExportDailyBomReportList.usingFormat`'s own reasoning exactly. */
  usingFormat: (format: string): Task =>
    Task.where(
      d`#actor exports the standard BOM report list using format "${format}"`,
      ViewStandardBomReportList.unfiltered(),
      ExportInFormat(format),
    ),

  /** "سینا از همان لیست فیلتر شده با فرمت «...» خروجی اکسل می گیرد" — the preceding Given
   * (`step-definitions/bom-reporting/exporting-standard-bom.steps.ts`) has already located AND
   * filtered the page; this must NOT navigate again, or the very filter this scenario means to
   * prove the export respects would be lost. */
  fromTheCurrentlyFilteredList: (format: string): Task =>
    Task.where(
      d`#actor exports the currently filtered standard BOM report list using format "${format}"`,
      ExportInFormat(format),
    ),
};
