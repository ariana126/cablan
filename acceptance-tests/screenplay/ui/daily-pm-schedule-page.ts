import { By, PageElement, PageElements } from '@serenity-js/web';
import { errorOfFieldLabelled, inputOfFieldLabelled } from './form-field';

const OPERATING_HOURS_LABEL = 'ساعت کارکرد دستگاه';

/**
 * Lean Page Object for `/pm-schedule/daily` («برنامه روزانه PM» under «فنی» — issue #69): today's
 * due and overdue work, each row with its own «ثبت انجام» action that opens a dialog with optional
 * notes. Locates elements and reports what they say — nothing else; the behaviour lives in
 * `screenplay/maintenance-management/pm-schedule.ts` and `pm-executions.ts`.
 *
 * Every locator is confirmed against the source (`frontend/src/app/features/pm-schedule/`: the page
 * and its record dialog), not yet against a rendered page. Once loaded, the table is drawn even
 * when empty — the «no work today» message sits below it, not as a Material no-data row (which
 * would carry `.mat-mdc-row` and read as data). The table is read **by column header** — «تجهیز», «فعالیت», «موعد», «وضعیت», «روزهای تاخیر» — so column order and any extra
 * (actions) column do not matter; header text is **not gated** by the accessibility check.
 *
 * ASSUMPTION (issue #108): the list is grouped — one section per equipment, and inside it one
 * group per specialty («برق», «مکانیک», «تخصص تعیین نشده»). Each group is its own native
 * `<table mat-table>`, and **every group's table keeps the same columns as today, «تجهیز»
 * included**, so a row reads the same whichever group it is in. Rows are read across every table in
 * rendered order. An empty day may draw no table, only the «no work today» message.
 */
const tables = () =>
  PageElements.located(By.css('table')).describedAs('daily PM tables');

export const DailyPmSchedulePage = {
  /** The page's `<h1>` is the menu label. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'برنامه روزانه PM', level: 1, exact: true }),
    ).describedAs('daily PM schedule heading'),

  /**
   * While the list loads the page shows a `role="progressbar"` (`mat-progress-bar` or
   * `mat-spinner`), and removes it once the rows — possibly none — are in. Without such a signal
   * an empty list cannot be told from one not loaded yet.
   */
  loadingIndicator: () =>
    PageElement.located(By.css('[role="progressbar"]')).describedAs(
      'daily PM loading indicator',
    ),

  tables,

  /** Every table's header cells (`<th>`), on the whole page. Structural, ungated. */
  columnHeaders: () =>
    PageElements.located(By.css('table thead th')).describedAs(
      'daily PM column headers',
    ),

  /** One table's header cells. Structural, ungated. */
  columnHeadersOf: (table: PageElement) =>
    PageElements.located(By.css('thead th'))
      .of(table)
      .describedAs('daily PM group column headers'),

  /** One table's body rows, one per due/overdue task. Structural, ungated. */
  rowsOf: (table: PageElement) =>
    PageElements.located(By.css('tbody tr.mat-mdc-row'))
      .of(table)
      .describedAs('daily PM group rows'),

  /**
   * The «no work today» message, «امروز کار سررسیده یا عقب افتاده‌ای نیست.» — a paragraph, not a
   * table row. Matched on its opening words. ASSUMPTION: kept as is when the list is grouped.
   */
  noWorkMessage: () =>
    PageElement.located(
      By.cssContainingText('p', 'امروز کار سررسیده یا عقب افتاده'),
    ).describedAs('no work today message'),

  /** The cells of one row — scope with `.of(row)`. Structural, ungated. */
  rowCells: () =>
    PageElements.located(By.css('td')).describedAs('daily PM row cells'),

  /**
   * Each row's record button, named for its activity and equipment so identical
   * buttons stay distinguishable — «ثبت انجام تعویض روغن اکسترودر 1».
   */
  recordButton: (activityName: string, equipmentName: string) =>
    PageElement.located(
      By.role('button', {
        name: `ثبت انجام ${activityName} ${equipmentName}`,
        exact: true,
      }),
    ).describedAs(`record button for "${activityName} ${equipmentName}"`),

  /** The record dialog's optional notes, a textarea labelled «توضیحات». */
  notesField: () =>
    PageElement.located(
      By.role('textbox', { name: 'توضیحات', exact: true }),
    ).describedAs('execution notes field'),

  /**
   * ASSUMPTION (issue #108): the record dialog's optional operating hours, a `mat-form-field`
   * labelled «ساعت کارکرد دستگاه» (unit «ساعت» as a suffix or hint). It must be a **text** input
   * (`type="text"`, `inputmode="decimal"`), not `type="number"`: the Gherkin types «دوازده» and
   * «abc» into it, which a number input silently discards (and Playwright refuses to fill), so
   * the visitor would never be told what was wrong. Found through its label whatever its role.
   */
  operatingHoursField: () => inputOfFieldLabelled(OPERATING_HOURS_LABEL),

  /**
   * ASSUMPTION: a negative or non-numeric value keeps the dialog open on submit — the submit button
   * stays enabled — and shows the field's `<mat-error>`. Structural anchor, **not gated**.
   */
  operatingHoursError: () => errorOfFieldLabelled(OPERATING_HOURS_LABEL),

  /** The record dialog's submit button. */
  submitRecordButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت انجام', exact: true }),
    ).describedAs('submit execution button'),

  /** A refused recording is shown in the dialog as a `role="alert"`. */
  recordDialogAlert: () =>
    PageElement.located(
      By.css('mat-dialog-container [role="alert"]'),
    ).describedAs('record dialog error message'),
};
