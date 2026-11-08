import { matches } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * Lean Page Object for «سفارشات» — `/orders` (issue #101, reworked by issue #111), reached from the
 * main menu's «برنامه‌ریزی» category. Locates elements and reports what they say; the behaviour
 * lives in `screenplay/planning/`.
 *
 * Every locator here is an **ASSUMPTION** taken from issue #111's pinned markup contract
 * (`docs/superpowers/specs/2026-11-08-orders-page-ux-design.md`) until it is confirmed against the
 * page:
 *
 * - the page's `<h1>` reads «سفارشات»; for Management and the System Admin a «تعریف سفارش» button;
 * - above the table, a search box (role `searchbox`) «جست‌وجوی سفارش» matching an order number as a
 *   substring, plus the «محصول» / «آنالیز روزانه» filters and «پاک کردن جست‌وجو و فیلترها» — only
 *   the search box is driven here;
 * - a `mat-table` (rows `tr.mat-mdc-row`, order number cell `td.mat-column-orderNumber`) whose rows
 *   carry no action buttons; the order number cell holds one button, `aria-label`
 *   «جزئیات سفارش <n>», found here by that accessible name alone — so no ungated class anchor is
 *   needed to reach an order (the button also holds an `aria-hidden` SVG `mat-icon`, which adds
 *   nothing to its name or text);
 * - that button opens a details panel on the same page — a `region` named by its `<h2>`
 *   «جزئیات سفارش <n>» — holding the order's actions «افزودن کد MI», «ویرایش» and «حذف» (exact
 *   texts) and «بستن جزئیات». On an order with daily BOMs, Management's «ویرایش» / «حذف» are
 *   `aria-disabled="true"` (`disabledInteractive`), not natively disabled — Playwright's enabled
 *   check honours `aria-disabled`, so waiting for `isEnabled()` still tells them apart;
 * - one `mat-dialog` (role `dialog`) at a time for defining and editing (fields «شماره سفارش», a
 *   text box, and «کدهای MI», a chip grid whose input is a `mat-autocomplete` combobox; each chosen
 *   code a `mat-chip-row` with a remove button «برداشتن <code>»; submit «ثبت»), for adding an MI
 *   code (field «کد MI», a single autocomplete combobox; submit «افزودن») and for confirming a
 *   deletion (submit «حذف»). An autocomplete's options read «<code> — <product>». The dialog's submit
 *   stays enabled while the form is invalid, so a submit with an empty order number shows the
 *   field's `<mat-error>` instead of doing nothing;
 * - a refusal (403/409/400 the form cannot place on a field) is told in the dialog's `role="alert"`
 *   banner (`dialog-alert.ts`), which keeps the dialog open; the System Admin's renumbering of an
 *   order in use opens the shared correction confirmation over the edit dialog
 *   (`correction-confirmation-dialog.ts`).
 */
/** The open dialog. While one is up, the CDK overlay hides the page behind it from role locators,
 * so the dialog's own controls are the only ones a role locator can reach anyway. */
const dialog = () =>
  PageElement.located(By.role('dialog')).describedAs('the open order dialog');

/** The details panel of `orderNumber` — a `region` named by its `<h2>`. */
const detailsOf = (orderNumber: string) =>
  PageElement.located(
    By.role('region', { name: `جزئیات سفارش ${orderNumber}`, exact: true }),
  ).describedAs(`details of order "${orderNumber}"`);

/** A button of `orderNumber`'s details panel, by its exact text. */
const detailsButton = (orderNumber: string, label: string) =>
  PageElement.located(By.role('button', { name: label, exact: true }))
    .of(detailsOf(orderNumber))
    .describedAs(`«${label}» of order "${orderNumber}"`);

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const OrdersPage = {
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'سفارشات', level: 1, exact: true }),
    ).describedAs('orders page heading'),

  defineButton: () =>
    PageElement.located(
      By.role('button', { name: 'تعریف سفارش', exact: true }),
    ).describedAs('define order button'),

  searchBox: () =>
    PageElement.located(
      By.role('searchbox', { name: 'جست‌وجوی سفارش', exact: true }),
    ).describedAs('order search box'),

  /** The button in the order number cell that opens the order's details panel. */
  detailsOpener: (orderNumber: string) =>
    PageElement.located(
      By.role('button', {
        name: `جزئیات سفارش ${orderNumber}`,
        exact: true,
      }),
    ).describedAs(`details button of order "${orderNumber}"`),

  details: detailsOf,

  addMiCodeButtonOf: (orderNumber: string) =>
    detailsButton(orderNumber, 'افزودن کد MI'),

  editButtonOf: (orderNumber: string) => detailsButton(orderNumber, 'ویرایش'),

  deleteButtonOf: (orderNumber: string) => detailsButton(orderNumber, 'حذف'),

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

  /** The define/edit dialog's chip-grid input: a `mat-autocomplete` combobox. */
  miCodesInput: () =>
    PageElement.located(By.role('combobox', { name: 'کدهای MI', exact: true }))
      .of(dialog())
      .describedAs('MI codes input'),

  /** A chosen code's chip remove button in the define/edit dialog. */
  removeMiCodeButton: (miCode: string) =>
    PageElement.located(
      By.role('button', { name: `برداشتن ${miCode}`, exact: true }),
    )
      .of(dialog())
      .describedAs(`remove MI code "${miCode}" button`),

  /** The add-MI-code dialog's single autocomplete combobox. */
  miCodeInput: () =>
    PageElement.located(By.role('combobox', { name: 'کد MI', exact: true }))
      .of(dialog())
      .describedAs('MI code input'),

  /**
   * An option of whichever autocomplete is open, by the MI code it starts with (an option reads
   * «1001 — کابل 2.5»; «1001» must not pick «10010 — …»). `mat-option` lives in its own overlay
   * pane, outside the dialog, so it is not scoped to it. Angular Material's host element selector,
   * ungated.
   */
  miCodeOption: (miCode: string) =>
    PageElements.located(By.css('mat-option'))
      .where(Text, matches(new RegExp(`^\\s*${escapeRegExp(miCode)}(\\s|$)`)))
      .first()
      .describedAs(`MI code option "${miCode}"`),

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
