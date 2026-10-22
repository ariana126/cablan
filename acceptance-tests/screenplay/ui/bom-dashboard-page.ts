import { equals } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';
import { JalaliDateTimeField } from './jalali-datetime-field';

const LINES_TABLE = '[aria-label="اجزا و مواد اولیه"]';

/** The card header's order-number cell — see `BomDashboardPage.orderNumberCellsInPanel`. */
const ORDER_NUMBER_CELL = '.analysis__order-number';

/** The per-product panel's two accepted `aria-label`s — the frontend labels it
 * "آنالیز های روزانه {productName}"; the bare product name is tolerated as a fallback. */
const panelScopes = (productName: string): string[] => [
  `[aria-label="آنالیز های روزانه ${productName}"]`,
  `[aria-label="${productName}"]`,
];

/** The edit-description dialog — see `BomDashboardPage.descriptionDialog`. Declared outside the
 * page object because its field and buttons scope themselves to it. */
const descriptionDialog = () =>
  PageElement.located(
    By.role('dialog', { name: 'ویرایش توضیحات', exact: true }),
  ).describedAs('edit description dialog');

/** The approval filter group — see `BomDashboardPage.approvalFilterGroup`. Declared outside the
 * page object because its buttons scope themselves to it. */
const approvalFilterGroup = () =>
  PageElement.located(
    By.role('group', { name: 'فیلتر تایید', exact: true }),
  ).describedAs('approval filter group');

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
 * a date-range control (`from`/`to` date-and-time pickers + "اعمال بازه" apply button) above a list of
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
        name: 'داشبورد روزانه',
        level: 1,
        exact: true,
      }),
    ).describedAs('page heading'),

  /** The from-side bound of the persistent date-range control — one `app-jalali-datetime-field`
   * (`ui/jalali-datetime-field.ts`). The dashboard's wording ("از تاریخ ثبت آنالیز", bound name
   * "آغاز بازه ثبت آنالیز") is longer than the daily-BOM report's ("از تاریخ ثبت") by design, so
   * these names are the dashboard's own, not the report's. */
  registeredAtFrom: () =>
    JalaliDateTimeField.labelled({
      dateLabel: 'از تاریخ ثبت آنالیز',
      timeLabel: 'از ساعت ثبت آنالیز',
      boundName: 'آغاز بازه ثبت آنالیز',
    }),

  /** The to-side bound of the same range — see `registeredAtFrom`. */
  registeredAtTo: () =>
    JalaliDateTimeField.labelled({
      dateLabel: 'تا تاریخ ثبت آنالیز',
      timeLabel: 'تا ساعت ثبت آنالیز',
      boundName: 'پایان بازه ثبت آنالیز',
    }),

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
        '[aria-label="محصولات دارای آنالیز روزانه"] td.mat-column-productName',
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
      By.role('button', { name: productName, exact: true }),
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
   * Order-number cells inside a per-product panel, in rendered (top-to-bottom, score-desc) order —
   * one per daily-BOM card currently shown (a card the approval filter excludes is not rendered).
   *
   * The order number replaced the tracking number as the dashboard's identifier for a daily BOM
   * (`bom-dashboard.feature` keys every list question by «شماره سفارش»), rendered in the card
   * header as `.analysis__order-number`, under the same BEM convention as the header's other cells.
   *
   * **Not protected by the accessibility gate.** `make lint-accessibility` grades accessible
   * names, not class names, so a rename of this class fails nothing before the suite does — see
   * the root `CLAUDE.md`'s note on structural selectors. Keep it in step with the frontend by hand.
   *
   * The page shows no score (GitHub issue #38), so the panels' score-desc order is what this
   * locator evidences; the score values themselves are read through the API
   * (`screenplay/bom-analyzing/bom-dashboard-product-details.ts`).
   */
  orderNumberCellsInPanel: (productName: string) =>
    PageElements.located(
      By.css(inPanel(productName, '.analysis__order-number')),
    ).describedAs(`order number cells for "${productName}", in rendered order`),

  /**
   * The daily-BOM cards inside a per-product panel, in rendered order — each one a list item
   * holding that analysis's header (order number, QC operator, description, approval) and its lines
   * table. The per-card locators below are relative, to be scoped with `.of(card)`, which is what
   * ties a line row to the order number of the card it sits in.
   */
  dailyBomCardsInPanel: (productName: string) =>
    PageElements.located(
      By.css(inPanel(productName, `li:has(${LINES_TABLE})`)),
    ).describedAs(`daily BOM cards for "${productName}", in rendered order`),

  /** The one card in a product's panel whose order number is `orderNumber`. */
  dailyBomCard: (productName: string, orderNumber: string) =>
    PageElements.located(By.css(inPanel(productName, `li:has(${LINES_TABLE})`)))
      .where(
        Text.of(PageElement.located(By.css(ORDER_NUMBER_CELL))),
        equals(orderNumber),
      )
      .first()
      .describedAs(`daily BOM card "${orderNumber}" in "${productName}"`),

  /** The order-number cell of one daily-BOM card — scope with `.of(card)`. Same class, and the
   * same ungated-selector caveat, as `orderNumberCellsInPanel`. */
  cardOrderNumberCell: () =>
    PageElement.located(By.css(ORDER_NUMBER_CELL)).describedAs(
      'order number cell',
    ),

  /**
   * The approval-status cell of one daily-BOM card — scope with `.of(card)`. Reads «تایید شده» or
   * «تایید نشده».
   *
   * Rendered in the card header beside the description, as `.analysis__approval-status`.
   *
   * **Not protected by the accessibility gate.** `make lint-accessibility` grades accessible
   * names, not class names, so a rename of this class fails nothing before the suite does — see
   * the root `CLAUDE.md`'s note on structural selectors. Keep it in step with the frontend by hand.
   */
  cardApprovalStatusCell: () =>
    PageElement.located(By.css('.analysis__approval-status')).describedAs(
      'approval status cell',
    ),

  /**
   * The approver cell of one daily-BOM card — scope with `.of(card)`. Reads the approver's display
   * name, or «-» when nobody has approved it (the plan's Global Constraints: "missing approver
   * shows `-`" — note this differs from the description cell's own em dash).
   *
   * Rendered in the card header beside `cardApprovalStatusCell`, as `.analysis__approved-by`.
   *
   * **Not protected by the accessibility gate.** `make lint-accessibility` grades accessible
   * names, not class names, so a rename of this class fails nothing before the suite does — see
   * the root `CLAUDE.md`'s note on structural selectors. Keep it in step with the frontend by hand.
   */
  cardApproverCell: () =>
    PageElement.located(By.css('.analysis__approved-by')).describedAs(
      'approver cell',
    ),

  /**
   * The card's approve button — scope with `.of(card)`. Offered to Management and System Admin
   * only, and only while the daily BOM is unapproved.
   *
   * A real `<button>` in the card body (not its header) whose accessible name is exactly «تایید»;
   * scoping to the card is what tells one card's button from another's, so the name needs no order
   * number in it. Once approved, the card offers `cardRevokeApprovalButton` in its place — the
   * approve/revoke tasks wait on that swap as the sign their request was answered. Located by
   * accessible name, so the accessibility gate does keep the name honest — though only the card's
   * initial state is audited, not the swapped one.
   */
  cardApproveButton: () =>
    PageElement.located(
      By.role('button', { name: 'تایید', exact: true }),
    ).describedAs('approve button'),

  /** The card's revoke-approval button — scope with `.of(card)`. In the card body, accessible
   * name exactly «لغو تایید», shown in place of `cardApproveButton` while the daily BOM is
   * approved. */
  cardRevokeApprovalButton: () =>
    PageElement.located(
      By.role('button', { name: 'لغو تایید', exact: true }),
    ).describedAs('revoke approval button'),

  /**
   * The inline weight editor's trigger for one line of one card — scope with `.of(card)`. Offered
   * to Management and System Admin only.
   *
   * Material's inline-edit pattern — a pencil `<button>` per line, in its own column of the lines
   * table (headed by a visually hidden «ویرایش»), whose accessible name reads the way the Gherkin
   * names the line, «ویرایش وزن مواد اولیه {material} جز {component}»; clicking it swaps the
   * rendered weight for `cardWeightInput`.
   */
  cardEditWeightButton: (componentName: string, materialName: string) =>
    PageElement.located(
      By.role('button', {
        name: `ویرایش وزن مواد اولیه ${materialName} جز ${componentName}`,
        exact: true,
      }),
    ).describedAs(`edit weight button for ${materialName} / ${componentName}`),

  /**
   * The inline weight input of one line — scope with `.of(card)`. Located by `aria-label` rather
   * than role, so it matches whether the frontend renders it `type="number"` (spinbutton) or text.
   *
   * `aria-label="وزن مواد اولیه {material} جز {component}"`; the input exists only while the line
   * is being edited, and closes once the save has been answered. Being an editing state, it is not
   * one the accessibility gate's per-route audit ever reaches, so its label is ungated too.
   */
  cardWeightInput: (componentName: string, materialName: string) =>
    PageElement.located(
      By.css(
        `input[aria-label="وزن مواد اولیه ${materialName} جز ${componentName}"]`,
      ),
    ).describedAs(`weight input for ${materialName} / ${componentName}`),

  /** The inline weight editor's save button — scope with `.of(card)`. Accessible name exactly
   * «ذخیره»; only one line of a card is edited at a time, so the card scope suffices. */
  cardSaveWeightButton: () =>
    PageElement.located(
      By.role('button', { name: 'ذخیره', exact: true }),
    ).describedAs('save weight button'),

  /**
   * The group holding the dashboard's two Excel-style approval filters, beside the date-range
   * control — they filter the whole dashboard (the product list and a selected product's panel),
   * server-side.
   *
   * ASSUMPTION (not built yet): a wrapper with `role="group"` and accessible name «فیلتر تایید».
   */
  approvalFilterGroup: () => approvalFilterGroup(),

  /**
   * The trigger of one approval filter, «وضعیت تایید» or «تایید کننده», inside
   * `approvalFilterGroup`. Opens the checkbox `MatDialog` below (`filterValueCheckbox`,
   * `filterSelectAllCheckbox`, `applyFilterButton`); the «تایید کننده» dialog also lists a
   * «بدون تایید کننده» value.
   *
   * ASSUMPTION (not built yet): the same convention as `BomReportsPage.columnFilterButton` — a
   * `<button aria-label="فیلتر {field}">` whose name grows «، N مقدار انتخاب شده» once active, so
   * it is matched by prefix rather than by an exact role name.
   */
  approvalFilterButton: (field: string) =>
    PageElement.located(By.css(`button[aria-label^="فیلتر ${field}"]`))
      .of(approvalFilterGroup())
      .describedAs(`approval filter button for "${field}"`),

  /** One checkbox per distinct value in the open filter dialog — same dialog markup as
   * `BomReportsPage.filterValueCheckbox`. */
  filterValueCheckbox: (value: string) =>
    PageElement.located(
      By.role('checkbox', { name: value, exact: true }),
    ).describedAs(`filter checkbox for value "${value}"`),

  /** Same dialog markup as `BomReportsPage.filterSelectAllCheckbox`. */
  filterSelectAllCheckbox: () =>
    PageElement.located(
      By.role('checkbox', { name: 'انتخاب همه', exact: true }),
    ).describedAs('filter panel "select all" checkbox'),

  /** Same dialog markup as `BomReportsPage.applyFilterButton` — closes the dialog. */
  applyFilterButton: () =>
    PageElement.located(
      By.role('button', { name: 'اعمال', exact: true }),
    ).describedAs('apply filter button'),

  /**
   * The description cell of one daily-BOM card's header table — scope with `.of(card)`. The
   * description belongs to the daily BOM as a whole, so the page shows it once per card here
   * rather than repeating it on every line; it reads '—' when the analysis has none.
   */
  cardDescriptionCell: () =>
    PageElement.located(By.css('.analysis__description')).describedAs(
      'description cell',
    ),

  /**
   * The card's edit-description button — scope with `.of(card)`. Offered to Management and System
   * Admin only. A real `<button>` in the card body beside `cardDescriptionCell`, accessible name
   * exactly «ویرایش توضیحات» (its `aria-describedby` points at the card's order number, which adds
   * a description, not a name). Scoping to the card is what tells one card's button from another's.
   * Opens `descriptionDialog`.
   */
  cardEditDescriptionButton: () =>
    PageElement.located(
      By.role('button', { name: 'ویرایش توضیحات', exact: true }),
    ).describedAs('edit description button'),

  /**
   * The edit-description `mat-dialog`, named by its title «ویرایش توضیحات». While it is open the
   * CDK overlay marks the page behind it `aria-hidden`, so nothing on the cards is reachable by
   * role until it closes. An editing state, so the accessibility gate's per-route audit never
   * reaches it — its names are ungated.
   */
  descriptionDialog: () => descriptionDialog(),

  /** The dialog's textarea, labelled «توضیحات». */
  descriptionDialogField: () =>
    PageElement.located(By.role('textbox', { name: 'توضیحات', exact: true }))
      .of(descriptionDialog())
      .describedAs('description field'),

  /** The dialog's submit button «ذخیره»; a successful save closes the dialog. */
  descriptionDialogSaveButton: () =>
    PageElement.located(By.role('button', { name: 'ذخیره', exact: true }))
      .of(descriptionDialog())
      .describedAs('save description button'),

  /**
   * The column headers of one card's lines table — scope with `.of(card)`. Lines are read by
   * header name, not by position, so each value lands under the column the page itself names.
   *
   * The lines table (`aria-label="اجزا و مواد اولیه"`) renders «نام جز» | «نام مواد اولیه» |
   * «وزن استاندارد» | «اختلاف وزن» | «وزن ثبت‌شده», every quantity through the Persian-number pipe,
   * plus — for Management and System Admin — the inline-edit pencil column, whose header is a
   * visually hidden «ویرایش». Lines are read by header name, so that extra column shifts nothing.
   * The «اختلاف وزن» cell is blank for a zero difference, otherwise the absolute difference inside
   * a pill with a direction arrow.
   *
   * **Header text is not protected by the accessibility gate**: the lines are read by these header
   * names, so a rename of «وزن استاندارد» or «اختلاف وزن» fails nothing before the suite does. It
   * has no «توضیحات» column — see `cardDescriptionCell`.
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
