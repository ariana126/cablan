import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for `/materials` (`frontend/src/app/features/materials/...` — no such route
 * exists yet at the time this was written; this is the **first** `screenplay/ui/` this suite has
 * ever had, per the dispatch this automation was written against). Locates elements and reports
 * what they say — nothing else; the behaviour that uses them lives in
 * `screenplay/bom-registration/`.
 *
 * Every locator below is an ASSUMPTION about markup that doesn't exist yet, made defensively by
 * anchoring on accessible name (role + visible text) rather than structure, the same way
 * `screenplay/ui/login-page.ts` and `screenplay/ui/users-page.ts` do. Expect to revisit every one
 * of them once the frontend actually lands.
 */
export const MaterialsPage = {
  /** ASSUMPTION: mirrors `UsersPage.heading()`'s "مدیریت کاربران" naming convention. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'مدیریت مواد اولیه', level: 1, exact: true }),
    ).describedAs('page heading'),

  /** ASSUMPTION: the button that opens the "new material" form/dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن مواد اولیه', exact: true }),
    ).describedAs('add material button'),

  /**
   * ASSUMPTION: the labelled name field inside whichever material form/dialog is currently open —
   * the "new material" and "edit material" forms are assumed to share one form component, and
   * therefore this one locator, the same way `LoginPage`'s fields serve the one `/login` page.
   * A plain text input gets an implicit ARIA `textbox` role, unlike `<input type="password">`
   * (see `LoginPage`'s comment on why its fields anchor on the `<mat-form-field>` wrapper
   * instead) — so a role-based lookup by the field's label is safe here.
   */
  nameField: () =>
    PageElement.located(
      By.role('textbox', { name: 'اسم مواد اولیه', exact: true }),
    ).describedAs('material name field'),

  /** ASSUMPTION: shared by the "new material" and "edit material" forms, mirroring "ثبت می کند". */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت', exact: true }),
    ).describedAs('submit button'),

  /**
   * The name field's `<mat-error>` — confirmed against the real markup
   * (`frontend/src/app/features/materials/material-form-dialog.ts` and its
   * `server-errors.ts#mapMaterialFormError`): both the missing-name (`validation-error`'s `name`
   * field) and duplicate-name (`material-name-already-exists`) rejections are mapped to the `name`
   * field, which Angular Material renders as a `<mat-error>` beside the input, not the dialog's
   * root `role="alert"` banner — that banner is reserved for an error `mapMaterialFormError`
   * doesn't attach to a field, which this feature never produces. Unlike
   * `LoginPage.errorMessage()`'s root-level `role="alert"` anchor, `<mat-error>` carries no
   * implicit ARIA role, so this anchors on the element itself. The corresponding `Ensure*` tasks
   * only assert this is visible, not what it says.
   */
  dialogError: () =>
    PageElement.located(By.css('mat-error')).describedAs(
      'material form error message',
    ),

  /**
   * ASSUMPTION: the materials list renders each material's name as a table cell — plain
   * `<td>`/`mat-cell` elements are implicitly `role="cell"` inside a table, so the visible name is
   * also the accessible name, the same "find by what a person would read" principle the rest of
   * this suite's locators follow.
   */
  materialNamed: (name: string) =>
    PageElement.located(By.role('cell', { name, exact: true })).describedAs(
      `material named "${name}"`,
    ),

  /**
   * ASSUMPTION: a row-level "edit"/"delete" icon button carries the material's own name in its
   * accessible name (e.g. `aria-label="ویرایش مس"`) so that otherwise-identical buttons across
   * rows remain individually distinguishable — a common accessible pattern for repeated row
   * actions, and the only way to target "the edit button for *this* material" by accessible name
   * alone rather than DOM structure.
   */
  editButton: (name: string) =>
    PageElement.located(
      By.role('button', { name: `ویرایش ${name}`, exact: true }),
    ).describedAs(`edit button for "${name}"`),

  deleteButton: (name: string) =>
    PageElement.located(
      By.role('button', { name: `حذف ${name}`, exact: true }),
    ).describedAs(`delete button for "${name}"`),

  /**
   * ASSUMPTION: the delete confirmation dialog's own confirm button, named generically (not with
   * the material's name embedded, unlike `deleteButton` above) since only one such dialog can be
   * open at a time.
   */
  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف', exact: true }),
    ).describedAs('confirm delete button'),
};
