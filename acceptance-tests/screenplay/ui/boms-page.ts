import { equals } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * ASSUMPTION: the preview that opens once a new daily BOM has been registered — a `mat-dialog`
 * (role `dialog`) named by its title «پیش‌نمایش آنالیز روزانه». The title carries a ZWNJ (U+200C)
 * between «پیش» and «نمایش», written as an escape so an editor cannot silently lose it. While the
 * dialog is open the CDK overlay marks the page behind it `aria-hidden`, so nothing in the list
 * underneath is reachable by role until it closes. Declared outside `BomsPage` because the other
 * preview locators scope themselves to it.
 */
const previewDialog = () =>
  PageElement.located(
    By.role('dialog', {
      name: 'پیش‌نمایش آنالیز روزانه',
      exact: true,
    }),
  ).describedAs('daily BOM preview');

/** ASSUMPTION: the preview's weight-difference table, by its accessible name. */
/**
 * One data row of the daily-BOM list. Structural selectors, **not protected by the accessibility
 * gate**: Angular Material puts `.mat-mdc-row` on every body row and `.mat-column-<def>` on every
 * cell of a `matColumnDef`, the same anchors `bom-reports-page.ts#orderNumberCells` uses. A renamed
 * column def fails nothing before the suite does.
 */
const listRows = () =>
  PageElements.located(By.css('tr.mat-mdc-row')).describedAs('daily BOM rows');

const ORDER_NUMBER_CELL = 'td.mat-column-orderNumber';
const TRACKING_NUMBER_CELL = 'td.mat-column-trackingNumber';

/**
 * ASSUMPTION (resampling-bom, not built yet): a row whose daily BOM is resamplable carries a
 * «نمونه گیری مجدد» button in its actions cell — scope with `.of(row)`. Matched by a name that
 * *starts with* «نمونه گیری مجدد» (an `aria-label` such as «نمونه گیری مجدد ORD-5002», after the
 * row's «جزئیات ORD-5002» convention) or by its visible text, since the exact name is not settled.
 * Written with plain spaces, as the Gherkin and the dispatch write it — a ZWNJ («نمونه‌گیری»)
 * in the frontend's label would miss it.
 */
const resampleButton = () =>
  PageElement.located(
    By.css(
      'button[aria-label^="نمونه گیری مجدد"], button:has-text("نمونه گیری مجدد")',
    ),
  ).describedAs('resample button');

const previewTable = () =>
  PageElement.located(
    By.role('table', { name: 'اختلاف وزن مواد اولیه', exact: true }),
  )
    .of(previewDialog())
    .describedAs('preview weight-difference table');

/**
 * Lean Page Object for the daily-BOM list's *registration* surface — `/boms`
 * (`frontend/src/app/features/boms/...`). Locates elements and reports what they say — nothing
 * else; the behaviour that uses them lives in
 * `screenplay/bom-registration/{register,edit,delete}-bom.ts` and `bom-form.ts`.
 *
 * **`ui/bom-reports-page.ts` describes the same page**, from the bom-reporting feature's side —
 * `/boms` is one screen carrying both the report and the register/edit/delete actions. Only the
 * heading is shared between them, and it has to stay in step in both files.
 *
 * A daily BOM's composition is never freely typed or picked: the whole thing is cloned the
 * instant a standard BOM is chosen by its MI code — the same assumption
 * `standard-boms-page.ts`'s own class-level note makes about a standard BOM cloning a product's
 * composition — and the only thing a visitor can still edit per line is a material's weight; there
 * is no "add component"/"add material" control and no per-row `combobox` to choose which master
 * component or material a line references. Mirrors `standard-boms-page.ts`'s own shape throughout.
 */
export const BomsPage = {
  /** Matches `frontend/src/app/features/boms/boms-page.ts`'s real `<h1>`, which
   * `ui/bom-reports-page.ts#heading` also locates. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'آنالیز های روزانه',
        level: 1,
        exact: true,
      }),
    ).describedAs('page heading'),

  /** ASSUMPTION: the button that opens the "new daily BOM" form/dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن آنالیز روزانه', exact: true }),
    ).describedAs('add daily BOM button'),

  /**
   * ASSUMPTION: chooses which standard BOM's composition is cloned into the form, by its MI code —
   * present only while registering a brand-new daily BOM, since the standard BOM a daily BOM is
   * based on can't be changed once one exists (the feature never edits it). Angular Material's
   * `mat-select` exposes an ARIA `combobox` role, the same mechanism as
   * `standard-boms-page.ts#productSelect`.
   */
  standardBomSelect: () =>
    PageElement.located(
      By.role('combobox', { name: 'کد MI آنالیز استاندارد', exact: true }),
    ).describedAs('standard BOM MI-code select'),

  /** ASSUMPTION: shared by the "new daily BOM" and "edit daily BOM" forms. */
  orderNumberField: () =>
    PageElement.located(
      By.role('textbox', { name: 'شماره سفارش', exact: true }),
    ).describedAs('order number field'),

  trackingNumberField: () =>
    PageElement.located(
      By.role('textbox', { name: 'شماره ردیابی', exact: true }),
    ).describedAs('tracking number field'),

  descriptionField: () =>
    PageElement.located(
      By.role('textbox', { name: 'توضیحات', exact: true }),
    ).describedAs('description field'),

  /** ASSUMPTION: shared by the "new daily BOM" and "edit daily BOM" forms. */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت آنالیز', exact: true }),
    ).describedAs('submit button'),

  /**
   * ASSUMPTION: this feature validates more than one independent field (order number, tracking
   * number, per-material weight) that can each fail on their own, so this is a *collection* of
   * `<mat-error>`s rather than one fixed locator — mirrors
   * `standard-boms-page.ts#formErrors`. Every scenario here only ever invalidates one field at a
   * time, so the corresponding `Ensure*` tasks (`bom-form.ts`) just wait for the first one to
   * become visible, never asserting wording.
   */
  formErrors: () =>
    PageElements.located(By.css('mat-error')).describedAs('form field errors'),

  /**
   * The form's own ROOT-level error, distinct from `formErrors()`'s per-field `<mat-error>`s —
   * `bom-form-dialog.ts` renders it as `<p class="form-error" role="alert">`, the same mechanism
   * `products-page.ts#formError` already uses. Not every rejection lands on a named field: per
   * `frontend/src/app/features/boms/server-errors.ts#toFieldError`'s own comment, a material's
   * weight is validated client-side before a submit can even reach the server, so a weight error
   * the server *does* still report (the "leave every material weight empty" rule's own case — the
   * client-side `min()` validator doesn't flag an emptied, not-a-number field the way it flags an
   * explicit zero) has "no reliable field path" and falls through to this root error instead of a
   * `mat-error`.
   */
  formError: () =>
    PageElement.located(By.role('alert')).describedAs('form error'),

  /**
   * The weight field for one specific, named material — labelled `وزن «<material name>» (گرم)`,
   * the material's own name baked in the same way `editButton`/`deleteButton` interpolate the
   * order number. Addressed by name rather than by row: since a component is never rendered with
   * its own selectable identity, the material's name, fetched from the API before the form is
   * filled in (`register-bom.ts`), is the only reliable way to reach one specific weight field.
   * `<input type="number">` maps to ARIA role `spinbutton`, not `textbox`, the same reason
   * `standard-boms-page.ts#weightField` isn't one either.
   */
  weightField: (materialName: string) =>
    PageElement.located(
      By.role('spinbutton', {
        name: `وزن «${materialName}» (گرم)`,
        exact: true,
      }),
    ).describedAs(`weight field for material "${materialName}"`),

  /**
   * ASSUMPTION: the daily BOM list renders each row's order number as a table cell — the
   * feature's own natural, always-present identifying field (unlike the standard BOM's MI code, a
   * daily BOM's own MI-code lookup is never stored as one of its own fields — see
   * `bom-details.ts`'s own comment), mirroring `StandardBomsPage.standardBomNamed`.
   */
  bomNamed: (orderNumber: string) =>
    PageElement.located(
      By.role('cell', { name: orderNumber, exact: true }),
    ).describedAs(`daily BOM with order number "${orderNumber}"`),

  /** The delete confirmation's one filled button: «حذف آنالیز», naming what it deletes. (A row's own
   * edit and delete sit in its overflow menu — `common/row-actions.ts`.) */
  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف آنالیز', exact: true }),
    ).describedAs('confirm delete button'),

  /** See the module-level `listRows` above. */
  rows: listRows,

  /** The rows whose «شماره ردیابی» cell reads `trackingNumber`. Ungated — see `listRows`. */
  rowsWithTrackingNumber: (trackingNumber: string) =>
    listRows()
      .where(
        Text.of(PageElement.located(By.css(TRACKING_NUMBER_CELL))),
        equals(trackingNumber),
      )
      .describedAs(`daily BOM rows with tracking number "${trackingNumber}"`),

  /** The first row whose «شماره سفارش» cell reads `orderNumber`. Ungated — see `listRows`. */
  rowWithOrderNumber: (orderNumber: string) =>
    listRows()
      .where(
        Text.of(PageElement.located(By.css(ORDER_NUMBER_CELL))),
        equals(orderNumber),
      )
      .first()
      .describedAs(`daily BOM row "${orderNumber}"`),

  /** See the module-level `resampleButton` above. */
  resampleButton,

  /**
   * Every material weight field of the open daily-BOM form, in rendered order — for the resample
   * form, which opens with the composition cloned and every weight empty, so a task can fill them
   * without knowing the material names. `<input type="number">` is a `spinbutton`; the open dialog
   * hides the page behind it from role locators (acceptance-tests/CLAUDE.md), so only the form's
   * own fields match. ASSUMPTION: the resample form has no other `spinbutton`.
   */
  weightFields: () =>
    PageElements.located(By.role('spinbutton')).describedAs(
      'material weight fields',
    ),

  /** See the module-level `previewDialog` above. */
  previewDialog,

  /** See the module-level `previewTable` above. */
  previewTable,

  /**
   * ASSUMPTION: the preview table's column headers — a native `<table mat-table>`, the same
   * `thead th` / `tbody tr` / `td` structure the dashboard's lines table has
   * (`bom-dashboard-page.ts#cardLineHeaderCells`). Lines are read by header name, not position.
   * **Header text is not protected by the accessibility gate**, so a rename of «نام جز»,
   * «نام مواد اولیه», «وزن مواد اولیه» or «اختلاف وزن» fails nothing before the suite does.
   */
  previewHeaderCells: () =>
    PageElements.located(By.css('thead th'))
      .of(previewTable())
      .describedAs('preview column headers'),

  /** The preview table's body rows. Structural selector, ungated — see `previewHeaderCells`. */
  previewRows: () =>
    PageElements.located(By.css('tbody tr'))
      .of(previewTable())
      .describedAs('preview rows'),

  /** The cells of one preview row — scope with `.of(row)`. */
  previewRowCells: () =>
    PageElements.located(By.css('td')).describedAs('preview row cells'),

  /** ASSUMPTION: the preview's «تایید» action, scoped to the dialog. */
  previewConfirmButton: () =>
    PageElement.located(By.role('button', { name: 'تایید', exact: true }))
      .of(previewDialog())
      .describedAs('preview confirm button'),

  /** ASSUMPTION: the preview's «ویرایش» action, scoped to the dialog. */
  previewEditButton: () =>
    PageElement.located(By.role('button', { name: 'ویرایش', exact: true }))
      .of(previewDialog())
      .describedAs('preview edit button'),
};
