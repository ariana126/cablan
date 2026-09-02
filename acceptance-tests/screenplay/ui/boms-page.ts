import { By, PageElement, PageElements } from '@serenity-js/web';

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
      By.role('button', { name: 'ثبت', exact: true }),
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

  editButton: (orderNumber: string) =>
    PageElement.located(
      By.role('button', { name: `ویرایش ${orderNumber}`, exact: true }),
    ).describedAs(`edit button for "${orderNumber}"`),

  deleteButton: (orderNumber: string) =>
    PageElement.located(
      By.role('button', { name: `حذف ${orderNumber}`, exact: true }),
    ).describedAs(`delete button for "${orderNumber}"`),

  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف', exact: true }),
    ).describedAs('confirm delete button'),
};
