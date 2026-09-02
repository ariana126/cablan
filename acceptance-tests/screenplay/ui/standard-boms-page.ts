import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for the standard-BOM list's *registration* surface — `/standard-boms`
 * (`frontend/src/app/features/standard-boms/...`). Locates elements and reports what they say —
 * nothing else; the behaviour that uses them lives in
 * `screenplay/bom-registration/{register,edit,delete}-standard-bom.ts` and `standard-bom-form.ts`.
 *
 * **`ui/standard-bom-reports-page.ts` describes the same page**, from the bom-reporting feature's
 * side — `/standard-boms` is one screen carrying both the report and the register/edit/delete
 * actions. Only the heading is shared between them, and it has to stay in step in both files.
 *
 * A Standard BOM's composition is never freely typed or picked: the whole thing is cloned the
 * instant a product is chosen (`StandardBomFormDialog#onProductChange` on the frontend), and the
 * only thing a visitor can still edit per line is a material's weight — there is no "add
 * component"/"add material" control and no per-row `combobox` to choose which master component or
 * material a line references (`frontend/src/app/features/standard-boms/standard-bom-form-dialog.ts`
 * is the source of truth for this). Each component renders as its own accessible `group`, its
 * accessible name carrying the component's own name (`'جز ' + name`, not a fixed `'جز'`); each
 * material is a `<mat-form-field>` directly inside that group, with no nested "مواد اولیه" grouping
 * of its own.
 */
export const StandardBomsPage = {
  /** Matches `frontend/src/app/features/standard-boms/standard-boms-page.ts`'s real `<h1>`. */
  heading: () =>
    PageElement.located(
      By.role('heading', {
        name: 'آنالیز های استاندارد',
        level: 1,
        exact: true,
      }),
    ).describedAs('page heading'),

  /** ASSUMPTION: the button that opens the "new standard BOM" form/dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن آنالیز استاندارد', exact: true }),
    ).describedAs('add standard BOM button'),

  /**
   * ASSUMPTION: chooses which product's composition is cloned into the form — present only while
   * registering a brand-new standard BOM, since a product can't be changed once one exists (the
   * feature never edits it). Angular Material's `mat-select` exposes an ARIA `combobox` role.
   */
  productSelect: () =>
    PageElement.located(
      By.role('combobox', { name: 'محصول', exact: true }),
    ).describedAs('product select'),

  /** ASSUMPTION: shared by the "new standard BOM" and "edit standard BOM" forms. */
  miCodeField: () =>
    PageElement.located(
      By.role('textbox', { name: 'کد MI', exact: true }),
    ).describedAs('MI code field'),

  brandField: () =>
    PageElement.located(
      By.role('textbox', { name: 'برند', exact: true }),
    ).describedAs('brand field'),

  /** `<input type="number">` maps to ARIA role `spinbutton`, not `textbox`. */
  standardLengthField: () =>
    PageElement.located(
      By.role('spinbutton', { name: 'متراژ استاندارد', exact: true }),
    ).describedAs('standard length field'),

  /**
   * A `mat-select` with two options (`فعال`/`غیرفعال`) and no default — which is what actually
   * satisfies "قانون: وضعیت فعال بودن ... باید ... مشخص شود": an untouched checkbox would already
   * read as an implicit `false`, indistinguishable from an explicit "غیرفعال", where this tri-state
   * combobox (unselected / فعال / غیرفعال) genuinely has nothing to default to. Driven via
   * `SelectOption` (`standard-bom-form.ts`), the same mechanism as `productSelect()`.
   */
  activeToggle: () =>
    PageElement.located(
      By.role('combobox', { name: 'فعال بودن', exact: true }),
    ).describedAs('active toggle'),

  descriptionField: () =>
    PageElement.located(
      By.role('textbox', { name: 'توضیحات', exact: true }),
    ).describedAs('description field'),

  /** ASSUMPTION: shared by the "new standard BOM" and "edit standard BOM" forms. */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت', exact: true }),
    ).describedAs('submit button'),

  /**
   * ASSUMPTION: unlike the single-field `ComponentsPage.dialogError()`/`MaterialsPage.dialogError()`,
   * this feature validates four independent fields (MI code, brand, standard length, active) that
   * can each fail on their own, so this is a *collection* of `<mat-error>`s rather than one fixed
   * locator. Every scenario here only ever invalidates one field at a time, so the corresponding
   * `Ensure*` tasks (`standard-bom-form.ts`) just wait for the first one to become visible, the
   * same way the single-field pages only assert visibility, never wording.
   */
  formErrors: () =>
    PageElements.located(By.css('mat-error')).describedAs('form field errors'),

  /**
   * The standard weight field for one specific, named material — labelled
   * `وزن استاندارد «<material name>» (گرم)`, the material's own name baked in the same way
   * `editButton`/`deleteButton` interpolate the MI code. Addressed by name rather than by row: since
   * a component is never rendered with its own selectable identity (no `componentSelect`, no
   * per-material grouping — see the class-level note), the material's name, fetched from the API
   * before the form is filled in (`register-standard-bom.ts#FillInClonedMaterialWeights`), is the
   * only reliable way to reach one specific weight field. `<input type="number">` maps to ARIA role
   * `spinbutton`, not `textbox`, the same reason `standardLengthField()` isn't one either.
   */
  weightField: (materialName: string) =>
    PageElement.located(
      By.role('spinbutton', {
        name: `وزن استاندارد «${materialName}» (گرم)`,
        exact: true,
      }),
    ).describedAs(`weight field for material "${materialName}"`),

  /**
   * ASSUMPTION: the standard BOM list renders each row's MI code as a table cell — the feature's
   * own natural, always-present identifying field — mirroring `ProductsPage.productNamed()`.
   */
  standardBomNamed: (miCode: string) =>
    PageElement.located(
      By.role('cell', { name: miCode, exact: true }),
    ).describedAs(`standard BOM with MI code "${miCode}"`),

  editButton: (miCode: string) =>
    PageElement.located(
      By.role('button', { name: `ویرایش ${miCode}`, exact: true }),
    ).describedAs(`edit button for "${miCode}"`),

  deleteButton: (miCode: string) =>
    PageElement.located(
      By.role('button', { name: `حذف ${miCode}`, exact: true }),
    ).describedAs(`delete button for "${miCode}"`),

  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف', exact: true }),
    ).describedAs('confirm delete button'),
};
