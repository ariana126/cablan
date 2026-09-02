import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for the daily-BOM list's *reporting* surface
 * (`frontend/src/app/features/boms/boms-page.ts`, route `/boms`) and its two dialogs
 * (`bom-report-filter-dialog.ts`, `bom-report-detail-dialog.ts`). Locates elements and reports what
 * they say — nothing else; the behaviour that uses them lives in
 * `screenplay/bom-reporting/bom-report-list.ts` and `bom-report-details.ts`.
 *
 * **`ui/boms-page.ts` describes the same page**, from the bom-registration feature's side. The two
 * are kept apart because each serves its own feature's domain layer, not because there are two
 * pages: `/boms` is one screen carrying both the report and the register/edit/delete actions. Only
 * the heading is shared between them, and it has to stay in step in both files.
 *
 * Reconciled against the real frontend markup — five things worth knowing that the ASSUMPTION-only
 * first pass got wrong or had to guess at:
 * - **The five checkbox-filter buttons live in their own toolbar** (`.filter-toolbar`), not one per
 *   column header — the list's own columns (`columnHeaders` below) don't 1:1 match the filterable
 *   fields (`نام جز` filters but is never a column; `شماره سفارش`/`شماره ردیابی` are columns with no
 *   filter), so the buttons couldn't live there anyway. Locating them by role/name
 *   (`فیلتر {field}`) doesn't care which container they're in, so no locator changed here.
 * - **"تاریخ و زمان ثبت" carries NO checkbox filter panel** — `columnFilterButton('تاریخ و زمان
 *   ثبت')` matches nothing; only the persistent range control below exists for it. The domain layer
 *   (`bom-report-list.ts`) routes that field's "single value selected" step through the range
 *   control instead (from = to = the one value), never through `columnFilterButton`.
 * - **The checkbox filter panel is a real `MatDialog`** (`BomReportFilterDialog`) — applying it
 *   really does close it, so `applyFilterButton`/`WaitForTheFilterPanelToClose` needed no change.
 * - **The date-range "اعمال بازه" button is a plain in-page `<button type="submit">`, not a dialog
 *   trigger** — it never disappears, applied or not, so waiting for it to vanish (as the filter
 *   dialog's own button legitimately does) never resolves. See `bom-report-list.ts`'s own
 *   `WaitForTheDateRangeToApply` for how it actually waits for the answer.
 * - **The list carries an eighth "عملیات" column**, holding the "جزئیات" detail button —
 *   `columnHeaders` below excludes it (`:not(.mat-column-actions)`, the class Angular Material's
 *   `matColumnDef="actions"` puts on that one `<th>`), since the feature's own "فقط شامل ستون های
 *   زیر باشد" rule enumerates only the seven *business* columns and knows nothing about a UI
 *   affordance column.
 *
 * The detail dialog's own composition table needed no reconciliation: `bom-report-detail-dialog.ts`
 * renders `<table mat-table aria-label="اجزا و مواد اولیه">` with real `<tbody>`/`<tr>`/`<td>`
 * markup underneath (Angular Material's native-table mode), so `detailComponentNameCells` and its
 * two siblings, unchanged, already locate the real thing.
 */
export const BomReportsPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'آنالیز های روزانه',
        level: 1,
        exact: true,
      }),
    ).describedAs('page heading'),

  /** One button per filterable field, living in the page's own `.filter-toolbar` rather than a
   * column header (see this module's class-level comment) — mirrors the checkbox-filterable fields
   * exactly (`نام جز` included, even though it's never a list column; "تاریخ و زمان ثبت" and
   * "وزن مواد اولیه" excluded, since neither ever gets one — see the feature's own "قانون: وزن مواد
   * اولیه در بین فیلدهای قابل فیلتر نیست"). */
  columnFilterButton: (column: string) =>
    PageElement.located(
      By.role('button', { name: `فیلتر ${column}`, exact: true }),
    ).describedAs(`filter button for column "${column}"`),

  /** One checkbox per distinct value inside whichever field's filter dialog is currently open,
   * labelled with the value's own display text. */
  filterValueCheckbox: (value: string) =>
    PageElement.located(
      By.role('checkbox', { name: value, exact: true }),
    ).describedAs(`filter checkbox for value "${value}"`),

  /** The open dialog's own master checkbox, toggling every individual value at once — unchecking it
   * clears every value (the "عدم انتخاب همه مقادیر" rule's own mechanism), checking it again
   * re-selects every value (the "انتخاب دوباره همه مقادیر" rule's). */
  filterSelectAllCheckbox: () =>
    PageElement.located(
      By.role('checkbox', { name: 'انتخاب همه', exact: true }),
    ).describedAs('filter panel "select all" checkbox'),

  applyFilterButton: () =>
    PageElement.located(
      By.role('button', { name: 'اعمال فیلتر', exact: true }),
    ).describedAs('apply filter button'),

  /** The "تاریخ و زمان ثبت" field's own persistent range control — never behind a "فیلتر" button,
   * and never a checkbox panel; see this module's class-level comment. */
  dateRangeFromField: () =>
    PageElement.located(
      By.role('textbox', { name: 'از تاریخ و زمان ثبت', exact: true }),
    ).describedAs('registered-at range "from" field'),

  dateRangeToField: () =>
    PageElement.located(
      By.role('textbox', { name: 'تا تاریخ و زمان ثبت', exact: true }),
    ).describedAs('registered-at range "to" field'),

  applyDateRangeButton: () =>
    PageElement.located(
      By.role('button', { name: 'اعمال بازه', exact: true }),
    ).describedAs('apply date range button'),

  /** The visible loading indicator while the report re-fetches — rendered only `@if (loading())`,
   * so its mere presence (not just visibility) is the signal `WaitForTheReportToSettle`
   * (`bom-report-list.ts`) polls on to know a filter/page/date-range change has been answered. */
  loadingIndicator: () =>
    PageElement.located(
      By.css(
        'mat-progress-bar[aria-label="در حال بارگذاری گزارش آنالیز های روزانه"]',
      ),
    ).describedAs('report loading indicator'),

  /** A `<th>` per column, implicitly `role="columnheader"` inside a table, read in rendered
   * (left-to-right DOM) order for the "لیست فقط شامل ستون های زیر باشد" rule — excluding the eighth
   * "عملیات" actions column (`.mat-column-actions`, the class Angular Material's own
   * `matColumnDef="actions"` puts on that header cell), since the feature's own rule enumerates only
   * the seven *business* columns and makes no claim about a UI affordance column. */
  columnHeaders: () =>
    PageElements.located(
      By.css('th[role="columnheader"]:not(.mat-column-actions)'),
    ).describedAs('report list column headers'),

  /**
   * "شماره سفارش" renders as the list's first column (`columnHeaders` above confirms this is the
   * order the feature itself specifies), so its cell is reachable positionally without a stable
   * per-row identity to hang a role-based lookup off — the same "no other reliable identity"
   * reasoning `standard-boms-page.ts#weightField`'s own comment gives for falling back to a
   * structural selector. Read in rendered (top-to-bottom) order, which is what both the "شماره
   * سفارش را از جدیدترین به قدیمی ترین نمایش داده شود" ordering rule and the plain "کدام آنالیز ها
   * نمایش داده شود" set-membership rules need.
   */
  orderNumberCells: () =>
    PageElements.located(By.css('.mat-mdc-row td:first-child')).describedAs(
      'order number cells, in rendered order',
    ),

  /** Opens the detail view for the daily BOM with this order number — a dialog, mirroring
   * this suite's established `*-form-dialog.ts` convention for every other "open a form/detail over
   * the list" interaction (`boms-page.ts`, `standard-boms-page.ts`). */
  detailButton: (orderNumber: string) =>
    PageElement.located(
      By.role('button', { name: `جزئیات ${orderNumber}`, exact: true }),
    ).describedAs(`detail button for "${orderNumber}"`),

  /**
   * The two write actions the *open detail card* carries, alongside the ones the list row carries
   * (`BomsPage.editButton`/`deleteButton`). Their accessible names are scoped to the daily BOM
   * (`ویرایش آنالیز روزانه 1001`) rather than bare verbs, precisely so all three surfaces stay
   * tellable apart while the card sits over the list: the row's own buttons read `ویرایش 1001`, and
   * the delete confirmation's reads `حذف`.
   *
   * No task drives these yet — no scenario in `reporting-bom.feature` acts from the card. They are
   * here as the markup contract the page has to keep, the same way this repo writes Gherkin ahead of
   * its automation.
   */
  detailEditButton: (orderNumber: string) =>
    PageElement.located(
      By.role('button', {
        name: `ویرایش آنالیز روزانه ${orderNumber}`,
        exact: true,
      }),
    ).describedAs(`detail card's edit button for "${orderNumber}"`),

  detailDeleteButton: (orderNumber: string) =>
    PageElement.located(
      By.role('button', {
        name: `حذف آنالیز روزانه ${orderNumber}`,
        exact: true,
      }),
    ).describedAs(`detail card's delete button for "${orderNumber}"`),

  /** The open detail dialog's own components/materials breakdown, rendered as a real
   * `<table><tbody><tr><td>` (Angular Material's native-table mode) — scoped to find its three
   * columns positionally (`detailComponentNameCells`/`detailMaterialNameCells`/`detailWeightCells`
   * below), the same "no other stable per-row identity" reasoning `orderNumberCells` above already
   * relies on. */
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

  /** The three scalar detail fields render as a `<dl>` description list — `<dt>`/`<dd>` pairs are a
   * legitimate, accessible way to present labelled read-only values with no natural ARIA role of
   * their own, the same reason `login-page.ts` anchors its own fields on an xpath rather than a
   * role. */
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

  /**
   * ASSUMPTION: export is offered through a single "خروجی اکسل" trigger button that opens a menu
   * of format choices — mirrors the checkbox-filter dialog's own trigger-then-panel shape
   * (`bom-report-list.ts#SelectOnlyTheseValuesFor`'s `columnFilterButton`/`filterValueCheckbox`
   * pair). `exporting-bom.feature` names exactly two formats ("هر مواد اولیه یک ردیف" / "هر
   * آنالیز روزانه یک ردیف"), each becoming one `exportFormatMenuItem` below. No frontend markup
   * exists yet to confirm this against — reconcile both locators here, the same way this module's
   * own class-level comment already records reconciliation for the report page's other controls,
   * once the real export UI lands.
   */
  exportButton: () =>
    PageElement.located(
      By.role('button', { name: 'خروجی اکسل', exact: true }),
    ).describedAs('export to Excel button'),

  /** ASSUMPTION: one menu item per export format, labelled with the format's own literal string —
   * see this module's `exportButton` comment. */
  exportFormatMenuItem: (format: string) =>
    PageElement.located(
      By.role('menuitem', { name: format, exact: true }),
    ).describedAs(`export format menu item "${format}"`),
};
