import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for the standard BOM report page
 * (`frontend/src/app/features/standard-boms/report/standard-boms-report-page.ts`, route `/standard-boms/report`)
 * and its detail dialog.
 *
 * Locates elements and reports what they say — nothing else; the behaviour that uses them lives in
 * `screenplay/bom-reporting/standard-bom-report-list.ts` and `standard-bom-report-details.ts`.
 *
 * Pattern: follows the same structure as `ui/bom-reports-page.ts` for daily BOM reports.
 * The standard BOM report shows MI codes (کد MI), product names (نام محصول), brands (برند),
 * and active status (فعال) in the list view.
 *
 * Filterable fields: برند, فعال, نام محصول, نام جز
 * Non-filterable: وزن مواد اولیه (per the feature rule)
 */

export const StandardBomReportsPage = {
  /** Main page heading: 'آنالیز های استاندارد' — the one standard-BOM page, which
   * `ui/standard-boms-page.ts#heading` also locates. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'آنالیز های استاندارد',
        level: 1,
        exact: true,
      }),
    ).describedAs('page heading'),

  /**
   * Filter button for a column field — lives in the page's own `.filter-toolbar`
   * (reconciled against real frontend markup).
   * Filterable fields: برند, فعال, نام محصول, نام جز
   */
  columnFilterButton: (column: string) =>
    PageElement.located(
      By.role('button', { name: `فیلتر ${column}`, exact: true }),
    ).describedAs(`filter button for column "${column}"`),

  /** Filter value checkbox - one per distinct value inside whichever field's filter dialog is open */
  filterValueCheckbox: (value: string) =>
    PageElement.located(
      By.role('checkbox', { name: value, exact: true }),
    ).describedAs(`filter checkbox for value "${value}"`),

  /** The open dialog's master checkbox, toggling every individual value at once */
  filterSelectAllCheckbox: () =>
    PageElement.located(
      By.role('checkbox', { name: 'انتخاب همه', exact: true }),
    ).describedAs('filter panel "select all" checkbox'),

  /** Apply filter button in the filter dialog */
  applyFilterButton: () =>
    PageElement.located(
      By.role('button', { name: 'اعمال فیلتر', exact: true }),
    ).describedAs('apply filter button'),

  /** The visible loading indicator while the report re-fetches */
  loadingIndicator: () =>
    PageElement.located(
      By.css(
        'mat-progress-bar[aria-label="در حال بارگذاری گزارش آنالیز های استاندارد"]',
      ),
    ).describedAs('report loading indicator'),

  /**
   * Column headers in the report table, excluding the two columns that are UI affordances rather
   * than business data: the trailing actions column and the leading `copyId` column (a
   * copy-the-row's-id button with a screen-reader-only header).
   * Standard BOM report columns: کد MI, نام محصول, برند, فعال
   * The product name header uses role="columnheader" with [attr.aria-sort] instead of
   * mat-sort-header, so the columnHeaders locator matches all th[role="columnheader"] elements.
   */
  columnHeaders: () =>
    PageElements.located(
      By.css(
        'th[role="columnheader"]:not(.mat-column-actions):not(.mat-column-copyId)',
      ),
    ).describedAs('report list column headers'),

  /**
   * Product name column header — clicking it sorts by product name (asc → desc → asc …).
   * The report defaults to ascending sort by product name.
   * The frontend uses role="columnheader" with [attr.aria-sort] instead of
   * mat-sort-header, with keyboard handlers for sorting.
   */
  productNameHeader: () =>
    PageElement.located(
      By.role('columnheader', { name: 'نام محصول', exact: true }),
    ).describedAs('product name column header'),

  /** MI Code cells. Anchored on the column's own `.mat-column-miCode` class rather than on
   * `td:first-child`: which column leads the row is a layout decision the frontend is free to
   * revisit (it did, when a leading copy-id column was added), while the column's name is part of
   * the contract this suite already reads in `productNameCells` below. */
  miCodeCells: () =>
    PageElements.located(
      By.css('.mat-mdc-row td.mat-column-miCode'),
    ).describedAs('MI code cells, in rendered order'),

  /** Product name cells */
  productNameCells: () =>
    PageElements.located(
      By.css('.mat-mdc-row td.mat-column-productName'),
    ).describedAs('product name cells, in rendered order'),

  /** Brand cells */
  brandCells: () =>
    PageElements.located(
      By.css('.mat-mdc-row td.mat-column-brand'),
    ).describedAs('brand cells, in rendered order'),

  /** Active status cells */
  activeStatusCells: () =>
    PageElements.located(
      By.css('.mat-mdc-row td.mat-column-active'),
    ).describedAs('active status cells, in rendered order'),

  /**
   * Detail button for a standard BOM with specific MI code.
   * Located in the actions column.
   */
  detailButton: (miCode: string) =>
    PageElement.located(
      By.role('button', { name: `جزئیات ${miCode}`, exact: true }),
    ).describedAs(`detail button for MI code "${miCode}"`),

  /**
   * The two write actions the *open detail card* carries, alongside the ones the list row carries
   * (`StandardBomsPage.editButton`/`deleteButton`). Their accessible names are scoped to the
   * standard BOM (`ویرایش آنالیز استاندارد 1001`) rather than bare verbs, so all three surfaces stay
   * tellable apart while the card sits over the list: the row's own buttons read `ویرایش 1001`, and
   * the delete confirmation's reads `حذف`.
   *
   * No task drives these yet — no scenario acts from the card. They are here as the markup contract
   * the page has to keep.
   */
  detailEditButton: (miCode: string) =>
    PageElement.located(
      By.role('button', {
        name: `ویرایش آنالیز استاندارد ${miCode}`,
        exact: true,
      }),
    ).describedAs(`detail card's edit button for MI code "${miCode}"`),

  detailDeleteButton: (miCode: string) =>
    PageElement.located(
      By.role('button', {
        name: `حذف آنالیز استاندارد ${miCode}`,
        exact: true,
      }),
    ).describedAs(`detail card's delete button for MI code "${miCode}"`),

  /**
   * The detail dialog's component/material breakdown table.
   * Rendered as a real `<table><tbody><tr><td>` (Angular Material native-table mode).
   */
  detailComponentNameCells: () =>
    PageElements.located(
      By.css('[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(1)'),
    ).describedAs('detail component-name cells, in rendered order'),

  detailMaterialNameCells: () =>
    PageElements.located(
      By.css('[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(2)'),
    ).describedAs('detail material-name cells, in rendered order'),

  detailWeightCells: () =>
    PageElements.located(
      By.css('[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(3)'),
    ).describedAs('detail weight cells, in rendered order'),

  /**
   * Scalar detail fields rendered as a `<dl>` description list.
   * Standard length label: "متراژ استاندارد"
   * Description label: "توضیحات"
   * Total weight label: "جمع وزن مواد اولیه"
   */
  detailStandardLength: () =>
    PageElement.located(
      By.xpath(
        '//dt[normalize-space(text())="متراژ استاندارد"]/following-sibling::dd[1]',
      ),
    ).describedAs('detail standard length value'),

  detailDescription: () =>
    PageElement.located(
      By.xpath(
        '//dt[normalize-space(text())="توضیحات"]/following-sibling::dd[1]',
      ),
    ).describedAs('detail description value'),

  detailTotalWeight: () =>
    PageElement.located(
      By.xpath(
        '//dt[normalize-space(text())="جمع وزن مواد اولیه"]/following-sibling::dd[1]',
      ),
    ).describedAs('detail total weight value'),

  /** Close button on the detail dialog */
  closeDetailButton: () =>
    PageElement.located(By.css('.detail-dialog .mat-dialog-close')).describedAs(
      'close detail button',
    ),

  /**
   * ASSUMPTION: export is offered through a single "خروجی اکسل" trigger button that opens a menu
   * of format choices — mirrors `ui/bom-reports-page.ts#exportButton`'s own ASSUMPTION exactly.
   * Frontend-engineer matched that guess exactly for the daily-BOM report
   * (`exporting-bom.feature`), which is why this repeats it here rather than guessing something
   * different; reconcile against real markup once `exporting-standard-bom.feature`'s own export
   * lands, the same way this module's other locators were reconciled against the report list and
   * detail dialog.
   */
  exportButton: () =>
    PageElement.located(
      By.role('button', { name: 'خروجی اکسل', exact: true }),
    ).describedAs('export to Excel button'),

  /** ASSUMPTION: one menu item per export format, labelled with the format's own literal string —
   * see this module's `exportButton` comment. `exporting-standard-bom.feature` names exactly two
   * formats ("هر مواد اولیه یک ردیف" / "هر آنالیز استاندارد یک ردیف"), each becoming one instance of
   * this locator. */
  exportFormatMenuItem: (format: string) =>
    PageElement.located(
      By.role('menuitem', { name: format, exact: true }),
    ).describedAs(`export format menu item "${format}"`),
};
