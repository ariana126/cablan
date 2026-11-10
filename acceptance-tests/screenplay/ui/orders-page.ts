import { matches } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * Lean Page Object for «سفارشات» — `/orders` (issue #101, reworked by issues #111 and #114),
 * reached from the main menu's «برنامه‌ریزی» category. Locates elements and reports what they say;
 * the behaviour lives in `screenplay/planning/`.
 *
 * Every locator here is an **ASSUMPTION** taken from issue #111's and #114's markup contracts
 * (`docs/superpowers/specs/2026-11-08-orders-page-ux-design.md`,
 * `docs/superpowers/specs/2026-11-10-orders-and-pm-history-ux-design.md`) until a suite run confirms
 * it against the page:
 *
 * - the page's `<h1>` reads «سفارشات»; for Management and the System Admin a «تعریف سفارش» button;
 * - above the table, a search box (role `searchbox`) «جست‌وجوی سفارش» matching an order number or a
 *   product name (issue #114 dropped the «محصول» / «آنالیز روزانه» filters, the daily-BOM column and
 *   «پاک کردن جست‌وجو و فیلترها»; an empty result offers «پاک کردن جست‌وجو», not driven here);
 * - a `mat-table` whose order number cell holds one button, `aria-label` «جزئیات سفارش <n>» — its
 *   hit area covers the whole row since issue #114 — found here by that accessible name alone, so no
 *   ungated class anchor is needed to reach an order;
 * - that button opens the order's details in a `mat-dialog` (issue #114; a `region` before) — role
 *   `dialog`, named by its `<h2>` «جزئیات سفارش <n>» — holding the actions «افزودن کد MI»,
 *   «ویرایش» and «حذف» (exact texts) and the head's close button «بستن». On an order with daily
 *   BOMs, Management's «ویرایش» / «حذف» are `aria-disabled="true"` (`disabledInteractive`), not
 *   natively disabled — Playwright's enabled check honours `aria-disabled`, so waiting for
 *   `isEnabled()` still tells them apart;
 * - **one dialog at a time**: choosing an action closes the details and opens the action's own
 *   dialog; when that closes (saved or cancelled) the page re-reads and **reopens the details** of
 *   the same order — except after a delete, when they stay closed. So "the action is answered" is
 *   "no dialog but the details is open", never "no dialog is open";
 * - the action dialogs (role `dialog`) for defining and editing (fields «شماره سفارش», a
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

/** The details dialog of `orderNumber` — named by its `<h2>`. */
const detailsOf = (orderNumber: string) =>
  PageElement.located(
    By.role('dialog', { name: `جزئیات سفارش ${orderNumber}`, exact: true }),
  ).describedAs(`details of order "${orderNumber}"`);

const DETAILS_DIALOG_NAME = /^جزئیات سفارش /;

/** A button of `orderNumber`'s details dialog, by its exact text. */
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

  /** Whichever order's details dialog is open — none, or one. */
  openDetails: () =>
    PageElements.located(
      By.role('dialog', { name: DETAILS_DIALOG_NAME }),
    ).describedAs('open order details dialogs'),

  /** The details dialog's close button «بستن» (its head's; Escape and the backdrop also close it). */
  closeDetailsButton: () =>
    PageElement.located(By.role('button', { name: 'بستن', exact: true }))
      .of(PageElement.located(By.role('dialog', { name: DETAILS_DIALOG_NAME })))
      .describedAs('close order details button'),

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
