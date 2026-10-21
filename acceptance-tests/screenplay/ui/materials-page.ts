import { includes } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * The `<mat-form-field>` whose `<mat-label>` reads `label` — the anchor a field-scoped
 * `<mat-error>` is reached through. The form has two fields that can each fail on their own (code
 * and name), so an unscoped `mat-error` could not tell a code error from a name error. Anchors on
 * Angular Material's own `mat-form-field`/`mat-label` elements, which the accessibility gate does
 * NOT protect; the label text itself is the same one `codeField()`/`nameField()` find their inputs
 * by, which it does. `includes` rather than `equals` tolerates surrounding whitespace; the two
 * labels («کد مواد اولیه», «اسم مواد اولیه») never contain one another.
 */
const formFieldLabelled = (label: string) =>
  PageElements.located(By.css('mat-form-field'))
    .where(Text.of(PageElement.located(By.css('mat-label'))), includes(label))
    .first()
    .describedAs(`"${label}" form field`);

const CODE_LABEL = 'کد مواد اولیه';
const NAME_LABEL = 'اسم مواد اولیه';

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
      By.role('textbox', { name: NAME_LABEL, exact: true }),
    ).describedAs('material name field'),

  /**
   * The labelled code field of the open material form — the label «کد مواد اولیه» is the one the
   * form has carried since the code field first existed (`material-form-dialog.ts`'s
   * `<mat-label>`); the form now shows it first and requires it, but its label is unchanged. Same
   * role-by-label lookup as `nameField()`.
   */
  codeField: () =>
    PageElement.located(
      By.role('textbox', { name: CODE_LABEL, exact: true }),
    ).describedAs('material code field'),

  /** The `<mat-error>` under the name field only — see `formFieldLabelled`. */
  nameError: () =>
    PageElement.located(By.css('mat-error'))
      .of(formFieldLabelled(NAME_LABEL))
      .describedAs('material name error message'),

  /**
   * The `<mat-error>` under the code field only — where both the blank-code error and the
   * duplicate-code (409 `material-code-already-exists`) error are expected to appear, the same way
   * the name's two errors appear under the name field. See `formFieldLabelled`.
   */
  codeError: () =>
    PageElement.located(By.css('mat-error'))
      .of(formFieldLabelled(CODE_LABEL))
      .describedAs('material code error message'),

  /** ASSUMPTION: shared by the "new material" and "edit material" forms, mirroring "ثبت می کند". */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت مواد اولیه', exact: true }),
    ).describedAs('submit button'),

  /**
   * ANY field's `<mat-error>` — the "the form has answered" signal
   * `materials-form.ts#WaitForTheMaterialFormToBeAnswered` polls for, whichever field failed.
   * Confirmed against the real markup (`frontend/src/app/features/materials/material-form-dialog.ts`
   * and its `server-errors.ts#mapMaterialFormError`): validation and uniqueness rejections are
   * mapped onto their field (`name` or `code`), which Angular Material renders as a `<mat-error>`
   * beside the input, not the dialog's root `role="alert"` banner. `<mat-error>` carries no
   * implicit ARIA role, so this anchors on the element itself. Assertions about *which* field
   * failed use `nameError()`/`codeError()` instead.
   */
  dialogError: () =>
    PageElement.located(By.css('mat-error')).describedAs(
      'material form error message',
    ),

  /**
   * Independent of column order (the list now shows the code column before the name column): it
   * matches any cell whose accessible name is the material's name.
   *
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

  /**
   * ASSUMPTION: the delete confirmation dialog's own confirm button, named generically (not with
   * the record's name embedded) since only one such dialog can be
   * open at a time.
   */
  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف مواد اولیه', exact: true }),
    ).describedAs('confirm delete button'),
};
