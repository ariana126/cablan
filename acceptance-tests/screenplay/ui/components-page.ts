import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for `/components` (`frontend/src/app/features/components/...` — no such route
 * exists yet at the time this was written, even though the backend's `components` module already
 * does). Locates elements and reports what they say — nothing else; the behaviour that uses them
 * lives in `screenplay/bom-registration/`.
 *
 * Every locator below is an ASSUMPTION about markup that doesn't exist yet, made defensively by
 * anchoring on accessible name (role + visible text) rather than structure — mirroring
 * `screenplay/ui/materials-page.ts` one-for-one against the frontend's real, already-shipped
 * `/materials` feature (`frontend/src/app/features/materials/{materials-page,
 * material-form-dialog,confirm-delete-material-dialog}.ts`), on the expectation that `/components`
 * will follow the same Angular Material dialog-form convention. Expect to revisit every one of
 * these once the frontend actually lands, in case it doesn't.
 */
export const ComponentsPage = {
  /** ASSUMPTION: mirrors `MaterialsPage.heading()`'s "مدیریت مواد اولیه" naming convention. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'مدیریت اجزا', level: 1, exact: true }),
    ).describedAs('page heading'),

  /** ASSUMPTION: the button that opens the "new component" form/dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن جز', exact: true }),
    ).describedAs('add component button'),

  /**
   * ASSUMPTION: the labelled name field inside whichever component form/dialog is currently
   * open — the "new component" and "edit component" forms are assumed to share one form
   * component, and therefore this one locator, the same way `MaterialsPage.nameField()` serves
   * both of the materials feature's forms. A plain text input gets an implicit ARIA `textbox`
   * role, so a role-based lookup by the field's label is safe here.
   */
  nameField: () =>
    PageElement.located(
      By.role('textbox', { name: 'اسم جز', exact: true }),
    ).describedAs('component name field'),

  /** ASSUMPTION: shared by the "new component" and "edit component" forms, mirroring "ثبت می کند". */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت جز', exact: true }),
    ).describedAs('submit button'),

  /**
   * ASSUMPTION: mirrors `MaterialsPage.dialogError()` — the name field's `<mat-error>`, since this
   * feature's rules (missing name, duplicate name) are both name-field validation failures an
   * Angular Material form is expected to render beside the input rather than in a dialog-root
   * banner. `<mat-error>` carries no implicit ARIA role, so this anchors on the element itself. The
   * corresponding `Ensure*` tasks only assert this is visible, not what it says.
   */
  dialogError: () =>
    PageElement.located(By.css('mat-error')).describedAs(
      'component form error message',
    ),

  /**
   * ASSUMPTION: the components list renders each component's name as a table cell — plain
   * `<td>`/`mat-cell` elements are implicitly `role="cell"` inside a table, so the visible name is
   * also the accessible name.
   */
  componentNamed: (name: string) =>
    PageElement.located(By.role('cell', { name, exact: true })).describedAs(
      `component named "${name}"`,
    ),

  /**
   * ASSUMPTION: a row-level "edit"/"delete" icon button carries the component's own name in its
   * accessible name (e.g. `aria-label="ویرایش مغزی"`) so that otherwise-identical buttons across
   * rows remain individually distinguishable.
   */
  editButton: (name: string) =>
    PageElement.located(
      By.role('button', { name: `ویرایش ${name}`, exact: true }),
    ).describedAs(`edit button for "${name}"`),

  /**
   * ASSUMPTION: the delete confirmation dialog's own confirm button, named generically (not with
   * the component's name embedded) since only one such dialog can be
   * open at a time.
   */
  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف جز', exact: true }),
    ).describedAs('confirm delete button'),

  /** The list itself — the page's data sheet, a `region` named by its «فهرست اجزا» heading. It is
   * there whether the list holds components or says none are registered. */
  list: () =>
    PageElement.located(
      By.role('region', { name: 'فهرست اجزا', exact: true }),
    ).describedAs('component list'),

  /** The list's result count («N نتیجه», `role="status"`) — drawn only once the list has loaded
   * and the system has answered with components rather than a refusal or an error. */
  listCount: () =>
    PageElement.located(By.role('status'))
      .of(ComponentsPage.list())
      .describedAs('component list count'),

  /** An error banner inside the list (`role="alert"`) — a refusal («شما دسترسی لازم …») or a
   * failed load. */
  listAlert: () =>
    PageElement.located(By.role('alert'))
      .of(ComponentsPage.list())
      .describedAs('component list error'),
};
