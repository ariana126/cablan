import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { Click, isVisible } from '@serenity-js/web';
import { BomReportsPage } from '../ui/bom-reports-page';
import { ViewBomReportList } from './bom-report-list';
import {
  CaptureTheDownloadTriggeredBy,
  TheDownloadedWorkbookGrid,
} from '../common/downloads';

/**
 * Domain layer for "خروجی اکسل آنالیز های روزانه" (`exporting-bom.feature`) — every scenario is
 * UI-voiced (an active "سینا ... خروجی اکسل می‌گیرد"), so every task here drives the real report
 * page's export control, never the API directly. `POST /boms/report/export` is API-internal per
 * the dispatch this automation was written against — the frontend calls it, this suite never does,
 * the same reason `bom-report-list.ts`'s own module comment gives for never calling
 * `POST /boms/report` directly either.
 */

/** Opens the export menu and picks `format`, capturing the resulting download — see
 * `ui/bom-reports-page.ts#exportButton`'s own comment for the ASSUMPTION this click sequence
 * rests on. */
const ExportInFormat = (format: string): Task =>
  Task.where(
    d`#actor exports the report list in format "${format}"`,
    Click.on(BomReportsPage.exportButton()),
    Wait.until(BomReportsPage.exportFormatMenuItem(format), isVisible()),
    CaptureTheDownloadTriggeredBy(BomReportsPage.exportFormatMenuItem(format)),
  );

export const ExportDailyBomReportList = {
  /** "سینا از لیست آنالیز های روزانه با فرمت «...» خروجی اکسل می گیرد" — no preceding "لیست را
   * مشاهده می کند" step has located the page first, so this locates it itself
   * (`ViewBomReportList.unfiltered()`), the same reuse `bom-report-details.ts#OpenBomReportDetails`
   * already relies on for its own, unrelated "جزئیات ... را باز می کند" step. */
  usingFormat: (format: string): Task =>
    Task.where(
      d`#actor exports the daily BOM report list using format "${format}"`,
      ViewBomReportList.unfiltered(),
      ExportInFormat(format),
    ),

  /** "سینا از همان لیست فیلتر شده با فرمت «...» خروجی اکسل می گیرد" — the preceding Given
   * (`step-definitions/bom-reporting/exporting-bom.steps.ts`) has already located AND filtered the
   * page; this must NOT navigate again, or the very filter this scenario means to prove the export
   * respects would be lost. */
  fromTheCurrentlyFilteredList: (format: string): Task =>
    Task.where(
      d`#actor exports the currently filtered daily BOM report list using format "${format}"`,
      ExportInFormat(format),
    ),
};

/** Row order in the downloaded workbook isn't a rule this feature makes any claim about — the
 * dedicated ordering rule lives on `reporting-bom.feature`, not this one — so every comparison
 * below sorts data rows before comparing them, the same "content matters, order doesn't" reasoning
 * `bom-report-list.ts#EnsureAllRegisteredDailyBomsAreShown`'s own comment gives for the report list
 * itself. Each row is joined with a control character no exported cell could ever legitimately
 * contain, so two rows can never collide into the same sort key by coincidence. Column order, on the
 * other hand, IS a rule (format 2 orders its per-component column pairs by the standard BOM's own
 * component and material order), so cells within a row are never reordered. */
const sortRows = (rows: string[][]): string[][] =>
  [...rows].sort((a, b) => a.join('\u0000').localeCompare(b.join('\u0000')));

/**
 * The downloaded grid in the shape a Gherkin table has: every cell a trimmed string (a numeric cell
 * `10` reads `"10"`, a text cell keeps its text, an empty cell is `""` — `downloads.ts#cellToString`)
 * and every row exactly as wide as the widest one, padded with `""`. The padding is what lets an
 * empty trailing cell — a component pair the row's analysis doesn't have, say — compare equal to
 * the Gherkin table's own empty cell whether or not the workbook stored it at all.
 */
const TheExportedWorkbookGrid = (): QuestionAdapter<{
  header: string[];
  dataRows: string[][];
}> =>
  Question.about('the exported workbook grid', async (actor) => {
    const [header = [], ...dataRows] = await actor.answer(
      TheDownloadedWorkbookGrid(),
    );
    const trimmedHeader = header.map((cell) => cell.trim());
    const width = Math.max(
      trimmedHeader.length,
      ...dataRows.map((row) => row.length),
    );
    const pad = (row: string[]): string[] =>
      Array.from({ length: width }, (_, index) => (row[index] ?? '').trim());
    const paddedRows = dataRows.map(pad);
    // Trailing all-empty rows are formatting, not records (a bordered but valueless row at the
    // bottom of the sheet); an empty row *between* records is kept, and would fail the comparison.
    while (
      paddedRows.length > 0 &&
      paddedRows[paddedRows.length - 1].every((cell) => cell === '')
    ) {
      paddedRows.pop();
    }
    return { header: pad(trimmedHeader), dataRows: paddedRows };
  });

/**
 * "فایل اکسل خروجی شامل موارد زیر باشد" ('bom' and 'standard-bom' alike — it reads only the
 * downloaded grid). The Gherkin table given to this step is the export's OWN full schema — every
 * column, header included — so this asserts the WHOLE grid in two steps: the header exactly and in
 * order first (so a misordered or misnamed column — «وزن مغزی ۱» vs «وزن مغزی 1» — is reported as
 * exactly that), then the data rows cell by cell under that header, as an order-independent set of
 * rows (see `sortRows`).
 */
export const EnsureExportedWorkbookIsExactly = (table: string[][]): Task => {
  const [header, ...dataRows] = table;
  return Task.where(
    '#actor ensures the exported workbook is exactly as expected',
    Ensure.that(TheExportedWorkbookGrid().header, equals(header)),
    Ensure.that(
      Question.about(
        'the exported workbook data rows, sorted for an order-independent comparison',
        async (actor) =>
          sortRows((await actor.answer(TheExportedWorkbookGrid())).dataRows),
      ),
      equals(sortRows(dataRows)),
    ),
  );
};

const ORDER_NUMBER_COLUMN = 'شماره سفارش';

const TheExportedWorkbookRowsProjectedOnto = (
  columns: string[],
  keepRow: (row: string[], header: string[]) => boolean = () => true,
): QuestionAdapter<string[][]> =>
  Question.about(
    'the exported workbook data rows, projected onto the given columns',
    async (actor) => {
      const { header, dataRows: allRows } = await actor.answer(
        TheExportedWorkbookGrid(),
      );
      const dataRows = allRows.filter((row) => keepRow(row, header));
      const columnIndexes = columns.map((column) => {
        const index = header.indexOf(column);
        if (index === -1) {
          throw new Error(
            `Column "${column}" was not found in the exported workbook's own header ` +
              `(${header.join(', ')}).`,
          );
        }
        return index;
      });
      const projectedRows = dataRows.map((row) =>
        columnIndexes.map((index) => row[index]),
      );
      return sortRows(projectedRows);
    },
  );

/**
 * "فایل اکسل خروجی فقط شامل موارد زیر باشد" ('bom' branch). Unlike `EnsureExportedWorkbookIsExactly`
 * above, this step's own table names only a FEW of the export's columns (the feature's own worked
 * example: "شماره سفارش"/"کد MI") — its point isn't the row's full shape (already proven by the
 * "شامل موارد زیر باشد" rule), only WHICH records a filter left behind. So this projects the
 * actual data rows down to just the named columns before comparing, rather than requiring the
 * header to match in full — an exact set match on that projection is what proves no OTHER record
 * (e.g. a filtered-out order number) leaked into the export.
 */
export const EnsureExportedWorkbookOnlyContains = (table: string[][]): Task => {
  const [header, ...dataRows] = table;
  return Task.where(
    '#actor ensures the exported workbook only contains the expected records',
    Ensure.that(
      TheExportedWorkbookRowsProjectedOnto(header),
      equals(sortRows(dataRows)),
    ),
  );
};

/** Keeps only the rows of the daily BOM `orderNumber` — whose «شماره سفارش» cell is it. */
const rowsOfTheDailyBom =
  (orderNumber: string) =>
  (row: string[], header: string[]): boolean =>
    row[header.indexOf(ORDER_NUMBER_COLUMN)] === orderNumber;

/** Each distinct row once — the per-material format repeats a daily BOM's own columns on every
 * one of its material rows. */
const distinctRows = (rows: string[][]): string[][] => [
  ...new Map(rows.map((row) => [row.join('\u0000'), row])).values(),
];

/**
 * "آنالیز روزانه با شماره سفارش «...» در فایل اکسل خروجی به صورت زیر باشد" — the step's table names a
 * few columns (the review's three) and the values one daily BOM has under them. Projects every row
 * of that daily BOM onto those columns: in the per-material format the daily BOM spans several rows,
 * each repeating its own columns, so they must all agree on the one row the table gives; in the
 * per-BOM format there is exactly one. A daily BOM missing from the export projects onto nothing,
 * and fails.
 */
export const EnsureExportedDailyBomRowsAre = (
  orderNumber: string,
  table: string[][],
): Task => {
  const [header, ...dataRows] = table;
  const noteColumn = header.indexOf(MANAGEMENT_NOTE_COLUMN);
  return Task.where(
    d`#actor ensures daily BOM "${orderNumber}" is exported as expected`,
    Ensure.that(
      Question.about(
        `the distinct exported rows of daily BOM "${orderNumber}", projected onto the given columns`,
        async (actor) =>
          distinctRows(
            (
              await actor.answer(
                TheExportedWorkbookRowsProjectedOnto(
                  header,
                  rowsOfTheDailyBom(orderNumber),
                ),
              )
            ).map((row) =>
              row.map((cell, index) =>
                index === noteColumn ? withoutEditHeadings(cell) : cell,
              ),
            ),
          ),
      ),
      equals(sortRows(dataRows)),
    ),
  );
};

const MANAGEMENT_NOTE_COLUMN = 'توضیحات مدیریت';

/** The heading line issue #73 puts above every review-edit block of a management note. */
const EDIT_HEADING =
  /^کاربر .+ در \d{4}\/\d{2}\/\d{2} ساعت \d{2}:\d{2} به علت .+ تغییرات زیر را انجام داد$/;

/**
 * The exported «توضیحات مدیریت» cell with its edit heading lines removed — its change lines only,
 * joined by `\n`. Only for this column, and only here: exporting-bom.feature's «توضیحات خودکار
 * ویرایش مدیریت در خروجی اکسل» predates issue #73, which made a heading («کاربر … در … ساعت … به علت
 * … تغییرات زیر را انجام داد») a mandatory prefix of every review-edit block, and that older Gherkin
 * states neither the reason nor the time the heading would carry. The stakeholder has been told to
 * update it; until then the export is checked on what the Gherkin does state, the change lines. A
 * rejection reason contains no heading line, so it is still compared whole.
 */
const withoutEditHeadings = (cell: string): string =>
  cell
    .split(/\r?\n/)
    .filter((line) => !EDIT_HEADING.test(line.trim()))
    .join('\n');

/**
 * "در فایل اکسل خروجی برای آنالیز روزانه با شماره سفارش «...» ... باشد" — the named cells of one
 * daily BOM's row (`وزن 1 متر`, `اختلاف با استاندارد`, …), keyed by column header and compared as
 * the workbook's display strings: a numeric cell `-610` reads `"-610"`, `129.23` reads `"129.23"`
 * (`downloads.ts#cellToString`). The same projection as `EnsureExportedDailyBomRowsAre`, so a
 * missing column or a missing daily BOM fails the same way.
 */
export const EnsureExportedDailyBomCellsAre = (
  orderNumber: string,
  cells: Record<string, string>,
): Task =>
  Task.where(
    d`#actor ensures the exported cells of daily BOM "${orderNumber}" are ${cells}`,
    EnsureExportedDailyBomRowsAre(orderNumber, [
      Object.keys(cells),
      Object.values(cells),
    ]),
  );
