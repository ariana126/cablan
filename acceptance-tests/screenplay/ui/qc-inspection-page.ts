import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * The table of one equipment's activities: the first table after the `h3` that names the
 * equipment, inside the equipment's `<section>`. Equipment names in the specs never hold an
 * apostrophe, so the name is a plain XPath string literal. Structural, **not gated**.
 */
const activitiesTableOf = (equipmentName: string) =>
  PageElement.located(
    By.xpath(
      `(//h3[normalize-space(.)='${equipmentName}']/following::table)[1]`,
    ),
  ).describedAs(`QC activities table of "${equipmentName}"`);

/**
 * Lean Page Object for `/qc-inspection` («بازرسی حین تولید» under «کنترل کیفیت» — issue #119): the
 * in-app QR scanner, and below it every in-service equipment's assigned activities with their last
 * execution, which the inspector schedules their next inspections from. Locates elements and
 * reports what they say — nothing else; the behaviour lives in
 * `screenplay/quality-control/qc-inspection.ts`.
 *
 * Confirmed against the source (`frontend/src/app/features/qc-inspection/qc-inspection-page.ts`):
 * an `<h1>` «بازرسی حین تولید»; per equipment a `<section>` named by its `h3` (the equipment's
 * name) around a `mat-table` whose header cells read «فعالیت» and «آخرین انجام»; a last execution
 * in Tehran time with **Persian digits** («۱۴۰۵/۰۷/۰۱ ۱۰:۰۰») or «بدون سابقه» — the domain layer reads
 * it back as the Gherkin writes it (`maintenance-pages.ts#asTheGherkinWritesIt`). A `role=
 * "progressbar"` only while the list loads. Header text and table structure are **not gated** by
 * the accessibility check.
 */
export const QcInspectionPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'بازرسی حین تولید', level: 1, exact: true }),
    ).describedAs('QC inspection page heading'),

  loadingIndicator: () =>
    PageElement.located(By.css('[role="progressbar"]')).describedAs(
      'QC inspection loading indicator',
    ),

  activitiesTableOf,

  /** The header cells of one equipment's table. Structural, ungated. */
  columnHeadersOf: (equipmentName: string) =>
    PageElements.located(By.css('thead th'))
      .of(activitiesTableOf(equipmentName))
      .describedAs(`QC activity column headers of "${equipmentName}"`),

  /** One body row per assigned activity. Structural, ungated. */
  rowsOf: (equipmentName: string) =>
    PageElements.located(By.css('tbody tr'))
      .of(activitiesTableOf(equipmentName))
      .describedAs(`QC activity rows of "${equipmentName}"`),

  /** The cells of one row — scope with `.of(row)`. Structural, ungated. */
  rowCells: () =>
    PageElements.located(By.css('td')).describedAs('QC activity row cells'),
};
