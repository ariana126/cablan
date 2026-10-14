import { By, PageElement, PageElements } from '@serenity-js/web';

const LINES_TABLE = '[aria-label="اجزا و مواد اولیه"]';

/** The per-product panel's two accepted `aria-label`s — the frontend labels it
 * "آنالیز های روزانه {productName}"; the bare product name is tolerated as a fallback. */
const panelScopes = (productName: string): string[] => [
  `[aria-label="آنالیز های روزانه ${productName}"]`,
  `[aria-label="${productName}"]`,
];

/** `selector` scoped to the per-product panel, under either of its accepted labels. */
const inPanel = (productName: string, selector: string): string =>
  panelScopes(productName)
    .map((scope) => `${scope} ${selector}`)
    .join(', ');

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
   * cells (which `trackingNumberCellsInPanel` below scopes to that panel by `aria-label`) don't match
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
   * stable per-row identity outside of this button (it is plain text in the row's first cell, with
   * no role/name hook to anchor a locator on for a specific product), so the suite addresses each
   * product through its select button's accessible name. That button's visible text is the bare
   * word "جزئیات", identical on every row, so the visible text alone cannot tell rows apart; its
   * accessible name is "جزئیات {productName}" (e.g. "جزئیات کابل مسی"), the same convention as
   * `BomReportsPage.detailButton(orderNumber)`'s `جزئیات {orderNumber}`, and that is what this
   * locator matches.
   */
  productSelectButton: (productName: string) =>
    PageElement.located(
      By.role('button', { name: `جزئیات ${productName}`, exact: true }),
    ).describedAs(`product select button for "${productName}"`),

  /**
   * The per-product panel that appears after a product is selected, listing its daily BOMs in
   * score-desc order. Anchored on the panel's own `aria-label` — the one landmark per product,
   * since the individual analyses have no stable identity of their own outside it.
   */
  productPanel: (productName: string) =>
    PageElement.located(
      By.css(panelScopes(productName).join(', ')),
    ).describedAs(`per-product panel for "${productName}"`),

  /**
   * Tracking-number cells inside a per-product panel, in rendered (top-to-bottom, score-desc)
   * order — one per daily-BOM card.
   *
   * Each daily-BOM card's header table is `aria-label="شماره ردیابی و امتیاز {trackingNumber}"`
   * with header columns «شماره ردیابی» | «امتیاز» | «توضیحات», and its cells carry
   * `mat-column-trackingNumber`, `mat-column-score` and `mat-column-description` — the tracking
   * number is the dashboard's identifier for a daily BOM. Anchored on the column class rather than
   * `td:first-child` so a reordered header table cannot silently feed scores in as tracking
   * numbers.
   */
  trackingNumberCellsInPanel: (productName: string) =>
    PageElements.located(
      By.css(inPanel(productName, 'td.mat-column-trackingNumber')),
    ).describedAs(
      `tracking number cells for "${productName}", in rendered order`,
    ),

  /** Score cells inside a per-product panel, in the same rendered order as
   * `trackingNumberCellsInPanel` — see that locator's ASSUMPTION. */
  scoreCellsInPanel: (productName: string) =>
    PageElements.located(
      By.css(inPanel(productName, 'td.mat-column-score')),
    ).describedAs(`score cells for "${productName}", in rendered order`),

  /**
   * The daily-BOM cards inside a per-product panel, in rendered order — each one a list item
   * holding that analysis's header table (tracking number, score, description) and its lines
   * table. The
   * per-card locators below are relative, to be scoped with `.of(card)`, which is what ties a line
   * row to the tracking number of the card it sits in.
   */
  dailyBomCardsInPanel: (productName: string) =>
    PageElements.located(
      By.css(inPanel(productName, `li:has(${LINES_TABLE})`)),
    ).describedAs(`daily BOM cards for "${productName}", in rendered order`),

  /** The tracking-number cell of one daily-BOM card — scope with `.of(card)`. */
  cardTrackingNumberCell: () =>
    PageElement.located(By.css('td.mat-column-trackingNumber')).describedAs(
      'tracking number cell',
    ),

  /**
   * The description cell of one daily-BOM card's header table — scope with `.of(card)`. The
   * description belongs to the daily BOM as a whole, so the page shows it once per card here
   * rather than repeating it on every line; it reads '—' when the analysis has none.
   */
  cardDescriptionCell: () =>
    PageElement.located(By.css('td.mat-column-description')).describedAs(
      'description cell',
    ),

  /**
   * The column headers of one card's lines table — scope with `.of(card)`. Lines are read by
   * header name, not by position, so each value lands under the column the page itself names.
   *
   * The lines table (`aria-label="اجزا و مواد اولیه"`) renders, in order, «نام جز» |
   * «نام مواد اولیه» | «وزن استاندارد مواد اولیه» | «وزن مواد اولیه» | «اختلاف وزن», the three
   * weights through the Persian-number pipe. It has no «توضیحات» column — see
   * `cardDescriptionCell`.
   */
  cardLineHeaderCells: () =>
    PageElements.located(By.css(`${LINES_TABLE} thead th`)).describedAs(
      'lines table column headers',
    ),

  /** The body rows of one card's lines table — scope with `.of(card)`. */
  cardLineRows: () =>
    PageElements.located(By.css(`${LINES_TABLE} tbody tr`)).describedAs(
      'lines table rows',
    ),

  /** The cells of one lines-table row — scope with `.of(row)`. */
  lineRowCells: () =>
    PageElements.located(By.css('td')).describedAs('line row cells'),
};
