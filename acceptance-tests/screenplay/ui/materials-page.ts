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
 * ASSUMPTION (issue #74, not built yet): the change-list dialog an accounting-Excel upload opens —
 * a `mat-dialog` (role `dialog`) named by its title «لیست تغییرات بارگذاری از اکسل». While it is
 * open the CDK overlay hides the page behind it from role locators, so every locator below that
 * belongs to the dialog is scoped to it. Declared outside `MaterialsPage` for that reason.
 */
const changeListDialog = () =>
  PageElement.located(
    By.role('dialog', {
      name: 'لیست تغییرات بارگذاری از اکسل',
      exact: true,
    }),
  ).describedAs('change-list dialog');

/**
 * ASSUMPTION (issue #74): the dialog's change table — a native `<table mat-table>`, the only table
 * in the dialog. Structural selector, **not protected by the accessibility gate**.
 */
const changeTable = () =>
  PageElement.located(By.css('table'))
    .of(changeListDialog())
    .describedAs('change-list table');

/** «۳» and «3» alike — the frontend may render a row number with Persian digits. */
const rowNumberPattern = (row: number): string => {
  const latin = String(row);
  const persian = latin.replace(/[0-9]/g, (digit) =>
    String.fromCharCode(0x06f0 + Number(digit)),
  );
  return latin === persian ? latin : `(?:${latin}|${persian})`;
};

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

  /**
   * ASSUMPTION (issue #74, not built yet): the button that opens the browser's file chooser for
   * the accounting Excel. Behind it sits a hidden `<input type="file">` labelled «فایل اکسل»; the
   * suite never touches that input — it answers the file chooser the click opens
   * (`common/uploads.ts#ChooseFileThrough`), so this button's accessible name is the contract.
   */
  importFromExcelButton: () =>
    PageElement.located(
      By.role('button', { name: 'بارگذاری از اکسل', exact: true }),
    ).describedAs('import from Excel button'),

  /** See the module-level `changeListDialog` above. */
  changeListDialog,

  /**
   * ASSUMPTION (issue #74): the change table's column headers — «ردیف» (the spreadsheet row
   * number), «تغییر» (a Persian description of the change, or the row's name/code for a row with
   * errors and no change) and «خطا» (the row's errors in Persian). Rows are read by header text,
   * not position. **Header text is not protected by the accessibility gate.**
   */
  changeHeaderCells: () =>
    PageElements.located(By.css('thead th'))
      .of(changeTable())
      .describedAs('change-list column headers'),

  /** ASSUMPTION (issue #74): one body row per change. Structural selector, ungated. */
  changeRows: () =>
    PageElements.located(By.css('tbody tr'))
      .of(changeTable())
      .describedAs('change-list rows'),

  /** The cells of one change row — scope with `.of(row)`. Structural selector, ungated. */
  changeRowCells: () =>
    PageElements.located(By.css('td')).describedAs('change-list row cells'),

  /**
   * ASSUMPTION (issue #74): each change row's own remove button, named for the spreadsheet row
   * number («حذف ردیف 3») so otherwise identical buttons stay distinguishable. Latin or Persian
   * digits both match.
   */
  removeChangeButton: (row: number) =>
    PageElement.located(
      By.role('button', {
        name: new RegExp(`^\\s*حذف ردیف ${rowNumberPattern(row)}\\s*$`),
      }),
    )
      .of(changeListDialog())
      .describedAs(`remove button for row ${row}`),

  /** ASSUMPTION (issue #74): the dialog's «تایید» action, which applies the change list. */
  confirmChangeListButton: () =>
    PageElement.located(By.role('button', { name: 'تایید', exact: true }))
      .of(changeListDialog())
      .describedAs('change-list confirm button'),

  /**
   * ASSUMPTION (issue #74): the message a refused confirm (400 `material-import-has-invalid-rows`)
   * shows in the still-open dialog, alongside the rows' own errors — a `role="alert"` element, the
   * mechanism the other form dialogs use (`<p class="form-error" role="alert">`).
   */
  changeListAlert: () =>
    PageElement.located(By.role('alert'))
      .of(changeListDialog())
      .describedAs('change-list error message'),
};
