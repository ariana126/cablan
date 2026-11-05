import { equals } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * Lean Page Object for «سفارشات» — `/orders` (issue #101), reached from the main menu's
 * «برنامه‌ریزی» category. Locates elements and reports what they say; the behaviour lives in
 * `screenplay/planning/`.
 *
 * Every locator here is an **ASSUMPTION** until the page exists — the frontend engineer reads them
 * and builds to match:
 *
 * - the page's `<h1>` reads «سفارشات»;
 * - a `mat-table` whose body rows are `tr.mat-mdc-row`, with an order number cell
 *   `td.mat-column-orderNumber` (header «شماره سفارش») and an MI codes cell (header «کدهای MI»).
 *   **These class anchors are not protected by the accessibility gate**: a renamed column def fails
 *   nothing before this suite does;
 * - for Management and the System Admin, a «تعریف سفارش» button over the table, and in each row
 *   three buttons — «افزودن کد MI», «ویرایش», «حذف» — each either reading exactly that text or
 *   carrying an `aria-label` that starts with it («ویرایش ORD-5001»);
 * - one `mat-dialog` (role `dialog`) at a time for defining and editing (fields «شماره سفارش», a
 *   text box, and «کدهای MI», a multiple `mat-select`; submit «ثبت»), for adding an MI code (field
 *   «کد MI», a single `mat-select`; submit «افزودن») and for confirming a deletion (submit «حذف»).
 *   The dialog's submit stays enabled while the form is invalid, so a submit with an empty order
 *   number shows the field's `<mat-error>` instead of doing nothing;
 * - a refusal (403/409/400 the form cannot place on a field) is told in the dialog's `role="alert"`
 *   banner (`dialog-alert.ts`), which keeps the dialog open; the System Admin's renumbering of an
 *   order in use opens the shared correction confirmation over the edit dialog
 *   (`correction-confirmation-dialog.ts`).
 */
const rows = () =>
  PageElements.located(By.css('tr.mat-mdc-row')).describedAs('order rows');

const ORDER_NUMBER_CELL = 'td.mat-column-orderNumber';

/** The open dialog. While one is up, the CDK overlay hides the page behind it from role locators,
 * so the dialog's own controls are the only ones a role locator can reach anyway. */
const dialog = () =>
  PageElement.located(By.role('dialog')).describedAs('the open order dialog');

/** A row button — exact text or an `aria-label` starting with `label`. Scope with `.of(row)`. */
const rowButton = (label: string) =>
  PageElement.located(
    By.css(`button[aria-label^="${label}"], button:has-text("${label}")`),
  ).describedAs(`«${label}» button`);

export const OrdersPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'سفارشات', level: 1, exact: true }),
    ).describedAs('orders page heading'),

  defineButton: () =>
    PageElement.located(
      By.role('button', { name: 'تعریف سفارش', exact: true }),
    ).describedAs('define order button'),

  /** The row whose «شماره سفارش» cell reads `orderNumber`. Ungated class anchors — see above. */
  rowOf: (orderNumber: string) =>
    rows()
      .where(
        Text.of(PageElement.located(By.css(ORDER_NUMBER_CELL))),
        equals(orderNumber),
      )
      .first()
      .describedAs(`order row "${orderNumber}"`),

  addMiCodeButton: () => rowButton('افزودن کد MI'),

  editButton: () => rowButton('ویرایش'),

  deleteButton: () => rowButton('حذف'),

  dialog,

  /** Every open dialog — two while the correction confirmation sits over the edit dialog. */
  openDialogs: () =>
    PageElements.located(By.role('dialog')).describedAs('open dialogs'),

  orderNumberField: () =>
    PageElement.located(
      By.role('textbox', { name: 'شماره سفارش', exact: true }),
    )
      .of(dialog())
      .describedAs('order number field'),

  /** The define/edit dialog's multiple select. `mat-select` exposes the ARIA `combobox` role. */
  miCodesSelect: () =>
    PageElement.located(By.role('combobox', { name: 'کدهای MI', exact: true }))
      .of(dialog())
      .describedAs('MI codes select'),

  /** The add-MI-code dialog's single select. ASSUMPTION: like «کدهای MI», disabled
   * (`aria-disabled="true"`) until its options have loaded — a `mat-select` with none won't open. */
  miCodeSelect: () =>
    PageElement.located(By.role('combobox', { name: 'کد MI', exact: true }))
      .of(dialog())
      .describedAs('MI code select'),

  /**
   * An option of whichever select is open, by the MI code it contains (an option may read
   * «1001 — کابل 2.5»). `mat-option` lives in its own overlay pane, outside the dialog, so it is
   * not scoped to it. Angular Material's host element selector, ungated.
   */
  miCodeOption: (miCode: string) =>
    PageElement.located(By.cssContainingText('mat-option', miCode)).describedAs(
      `MI code option "${miCode}"`,
    ),

  submitButton: () =>
    PageElement.located(By.role('button', { name: 'ثبت', exact: true }))
      .of(dialog())
      .describedAs('order dialog submit button'),

  addButton: () =>
    PageElement.located(By.role('button', { name: 'افزودن', exact: true }))
      .of(dialog())
      .describedAs('add MI code button'),

  confirmDeleteButton: () =>
    PageElement.located(By.role('button', { name: 'حذف', exact: true }))
      .of(dialog())
      .describedAs('confirm delete order button'),

  /** Field-level errors of the open dialog. */
  formErrors: () =>
    PageElements.located(By.css('mat-error')).describedAs('order form errors'),
};
