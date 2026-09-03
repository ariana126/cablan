import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for the daily-BOM dashboard
 * (`frontend/src/app/features/bom-analyzing/bom-dashboard-page.ts`, route `/boms/dashboard`).
 * Locates elements and reports what they say — nothing else; the behaviour that uses them lives in
 * `screenplay/bom-analyzing/bom-dashboard-list.ts` and `bom-dashboard-product-details.ts`.
 *
 * ASSUMPTION: this page is the closest visual analogue of `bom-reports-page.ts`/`boms-page.ts` —
 * a date-range control (`from`/`to` text fields + "اعمال بازه" apply button) above a list of
 * products that have daily BOMs in that range, with the per-product daily BOM rows loaded lazily
 * on selection (mirrors the dispatch's "fetch each product's boms with their details when the user
 * selects that product" instruction). The exact container element the per-product panel renders
 * into is intentionally left to the frontend to decide — the locators below anchor on accessible
 * names where one exists (the heading, the apply button, the per-product select button) and on
 * structural selectors where one doesn't (the per-row component/material/weight cells), so the
 * frontend agent can rearrange wrapper markup without breaking the suite.
 */
export const BomDashboardPage = {
  /** The visible h1 a locator task waits for after every navigation to this page — mirrors
   * `BomReportsPage.heading` (same pattern, same convention). */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'داشبورد بررسی روزانه آنالیز ها',
        level: 1,
        exact: true,
      }),
    ).describedAs('page heading'),

  /** The from-side text field of the persistent date-range control. The dashboard's own wording
   * ("از تاریخ ثبت آنالیز") differs from the daily-BOM report's ("از تاریخ و زمان ثبت") by
   * design — `frontend/src/app/features/bom-dashboard/bom-dashboard-page.html` uses the shorter
   * "ثبت آنالیز" for the dashboard context, so the locator matches that, not the report's. */
  dateRangeFromField: () =>
    PageElement.located(
      By.role('textbox', { name: 'از تاریخ ثبت آنالیز', exact: true }),
    ).describedAs('registered-at range "from" field'),

  /** The to-side text field of the same persistent date-range control — see `dateRangeFromField`
   * for the wording choice. */
  dateRangeToField: () =>
    PageElement.located(
      By.role('textbox', { name: 'تا تاریخ ثبت آنالیز', exact: true }),
    ).describedAs('registered-at range "to" field'),

  /** The from-side *time* field — `app-jalali-datetime-field` renders the date and the time of
   * day as two separate controls bound to the same value (`ui/jalali-datetime-field/
   * jalali-datetime-field.ts`), so a range's "from" instant is only fully entered once both this
   * and `dateRangeFromField` are filled. See `screenplay/common/jalali-datetime.ts#
   * splitJalaliDateTimeText`, which every date-range task uses to fill this pair.
   *
   * `role: 'combobox'`, not `'textbox'` — `MatTimepickerInput` implements the full ARIA combobox
   * pattern (it owns a popup listbox of time options), unlike `MatDatepickerInput`'s plain text
   * role. Reconciled against the real accessibility tree; a `'textbox'` locator here matches
   * nothing and times out. */
  dateRangeFromTimeField: () =>
    PageElement.located(
      By.role('combobox', { name: 'از ساعت ثبت آنالیز', exact: true }),
    ).describedAs('registered-at range "from" time field'),

  /** The to-side time field — see `dateRangeFromTimeField`. */
  dateRangeToTimeField: () =>
    PageElement.located(
      By.role('combobox', { name: 'تا ساعت ثبت آنالیز', exact: true }),
    ).describedAs('registered-at range "to" time field'),

  /** The "اعمال بازه" submit button — mirrors `BomReportsPage.applyDateRangeButton`. */
  applyDateRangeButton: () =>
    PageElement.located(
      By.role('button', { name: 'اعمال بازه', exact: true }),
    ).describedAs('apply date range button'),

  /** The visible loading indicator while the product list re-fetches after a date-range change —
   * rendered only `@if (loading())` (mirrors `BomReportsPage.loadingIndicator`). */
  loadingIndicator: () =>
    PageElement.located(
      By.css(
        'mat-progress-bar[aria-label="در حال بارگذاری داشبورد آنالیز های روزانه"]',
      ),
    ).describedAs('dashboard loading indicator'),

  /** The product-name cells of the dashboard's top-level product list (i.e. the list of products
   * that have at least one daily BOM in the currently-applied range), in rendered (top-to-bottom)
   * order. The dashboard's product list is itself a `mat-table` whose product name genuinely does
   * lead each row, so `td:first-child` reaches the right cells here — the per-product panel's own
   * cells (which `orderNumberCellsInPanel` below scopes to that panel by `aria-label`) don't match
   * this unscoped selector, since the per-product panel lives in its own subtree. Note the two
   * report lists no longer anchor this way: a leading copy-id column displaced their first cell,
   * and they were moved onto `.mat-column-*` names. This list has no such column, so the
   * positional anchor still holds — but it is the same fragility, one restructure away. */
  productNameCells: () =>
    PageElements.located(
      By.css(
        '[aria-label="محصولات دارای آنالیز روزانه"] .mat-mdc-row td:first-child',
      ),
    ).describedAs('product list product-name cells, in rendered order'),

  /**
   * The per-product "select" button on the dashboard's product list. The product name has no
   * stable per-row identity outside of this button (the surrounding cells carry the count next to
   * the name, but no role/name hook to anchor a locator on for a specific product), so the suite
   * addresses each product by its accessible name on its own select button. The exact label text
   * ("انتخاب {productName}" vs a plain button with the product name as its visible label) is left
   * to the frontend to decide — the locator below assumes the button's accessible name is exactly
   * the product name, the same way `BomReportsPage.detailButton(orderNumber)`'s `جزئیات …` is.
   */
  productSelectButton: (productName: string) =>
    PageElement.located(
      By.role('button', { name: productName, exact: true }),
    ).describedAs(`product select button for "${productName}"`),

  /**
   * The per-product panel that appears after a product is selected, listing its daily BOMs in
   * score-desc order. The page itself has no stable per-row identity for the individual
   * analyses, so a row-anchored locator works off the product panel's own `aria-label`
   * (the frontend's natural choice for a single landmark per product, since the panel replaces
   * the per-product select button once selected).
   *
   * Within the panel, the order number / score / per-line cells are reached positionally — the
   * dashboard's panel table renders columns "شماره سفارش" and "امتیاز" for the analysis rows
   * themselves, then a nested per-line component/material/weight breakdown (mirrors
   * `BomReportsPage.orderNumberCells` / `detailComponentNameCells` in the existing suite).
   */
  productPanel: (productName: string) =>
    PageElement.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"], [aria-label="${productName}"]`,
      ),
    ).describedAs(`per-product panel for "${productName}"`),

  /** Order number cells inside a per-product panel, in rendered (top-to-bottom, score-desc) order.
   * Mirrors `BomReportsPage.orderNumberCells` (`.mat-mdc-row td:first-child` scoped to the panel). */
  orderNumberCellsInPanel: (productName: string) =>
    PageElements.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"] .mat-mdc-row td:first-child, ` +
          `[aria-label="${productName}"] .mat-mdc-row td:first-child`,
      ),
    ).describedAs(`order number cells for "${productName}", in rendered order`),

  /** Score cells inside a per-product panel, in the same rendered order as
   * `orderNumberCellsInPanel`. */
  scoreCellsInPanel: (productName: string) =>
    PageElements.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"] .mat-mdc-row td.mat-column-score, ` +
          `[aria-label="${productName}"] .mat-mdc-row td.mat-column-score`,
      ),
    ).describedAs(`score cells for "${productName}", in rendered order`),

  /**
   * The per-line component/material/actual/standard weight/description breakdown rendered under
   * each order-number row inside the per-product panel. The breakdown is a real
   * `<table><tbody><tr><td>` (Angular Material's native-table mode — mirrors
   * `BomReportsPage.detailComponentNameCells` & siblings, which use the same convention).
   *
   * The locator is scoped to the per-product panel by `aria-label`, exactly the way
   * `BomReportsPage.detailComponentNameCells` scopes to the detail dialog by its own `aria-label`.
   */
  lineComponentNameCells: (productName: string) =>
    PageElements.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(1), ' +
          `[aria-label="${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(1)',
      ),
    ).describedAs(
      `per-line component-name cells for "${productName}", in rendered order`,
    ),

  lineMaterialNameCells: (productName: string) =>
    PageElements.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(2), ' +
          `[aria-label="${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(2)',
      ),
    ).describedAs(
      `per-line material-name cells for "${productName}", in rendered order`,
    ),

  lineActualWeightCells: (productName: string) =>
    PageElements.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(3), ' +
          `[aria-label="${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(3)',
      ),
    ).describedAs(
      `per-line actual-weight cells for "${productName}", in rendered order`,
    ),

  /** The per-line description cells inside a per-product panel's breakdown. Reached by the same
   * per-line row identity as the component/material/weight cells. */
  lineDescriptionCells: (productName: string) =>
    PageElements.located(
      By.css(
        `[aria-label="آنالیز های روزانه ${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(4), ' +
          `[aria-label="${productName}"] ` +
          '[aria-label="اجزا و مواد اولیه"] tbody tr td:nth-child(4)',
      ),
    ).describedAs(
      `per-line description cells for "${productName}", in rendered order`,
    ),
};
