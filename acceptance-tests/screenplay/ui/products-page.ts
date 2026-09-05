import { Answerable } from '@serenity-js/core';
import { By, PageElement, PageElements } from '@serenity-js/web';

/**
 * Lean Page Object for `/products` (`frontend/src/app/features/products/...` — no such route
 * exists yet at the time this was written; neither does the backend's `products` module, which is
 * being built in parallel against the same dispatch this automation was written against). Locates
 * elements and reports what they say — nothing else; the behaviour that uses them lives in
 * `screenplay/bom-registration/{register,edit,delete}-product.ts` and `products-form.ts`.
 *
 * Every locator below is an ASSUMPTION about markup that doesn't exist yet, made defensively by
 * anchoring on accessible name (role + visible text) rather than structure — mirroring
 * `screenplay/ui/components-page.ts` and `screenplay/ui/materials-page.ts`, on the expectation that
 * `/products` follows the same Angular Material dialog-form convention. The one structural
 * departure from those two: a product's components and each component's materials are dynamic,
 * repeatable groups (an Angular `FormArray`, most likely), so this page also has to locate *rows*
 * of a form, not just fields.
 */
export const ProductsPage = {
  /** ASSUMPTION: mirrors `ComponentsPage.heading()`'s "مدیریت اجزا" naming convention. */
  heading: () =>
    PageElement.located(
      By.role('heading', { name: 'مدیریت محصولات', level: 1, exact: true }),
    ).describedAs('page heading'),

  /** ASSUMPTION: the button that opens the "new product" form/dialog. */
  addButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن محصول', exact: true }),
    ).describedAs('add product button'),

  /**
   * The labelled name field inside whichever product form/dialog is currently open — the "new
   * product" and "edit product" forms share one form component, and therefore this one locator, the
   * same way `ComponentsPage.nameField()`/`MaterialsPage.nameField()` serve both of their respective
   * forms. Unlike a component's/material's own name, a *product's* own name is still a plain
   * free-text field (`product-form-dialog.ts`) — only the component/material pickers *inside* it
   * became `mat-select`s.
   */
  nameField: () =>
    PageElement.located(
      By.role('textbox', { name: 'اسم محصول', exact: true }),
    ).describedAs('product name field'),

  /** ASSUMPTION: shared by the "new product" and "edit product" forms, mirroring "ثبت می کند". */
  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ثبت', exact: true }),
    ).describedAs('submit button'),

  /**
   * ASSUMPTION: unlike `ComponentsPage.dialogError()`/`MaterialsPage.dialogError()` — a field-level
   * `<mat-error>` next to a name input — this feature's own two rules ("هر محصول حداقل یک جز دارد",
   * "هر جز حداقل یک مواد اولیه دارد") aren't about any *one* field, so this anchors on one
   * root-level `role="alert"` banner instead, mirroring `LoginPage.errorMessage()`. This feature
   * never tests a product-name validation rule, so there's no field-level error to disambiguate
   * from. The corresponding `Ensure*` tasks (`products-form.ts`) only assert this is visible, not
   * what it says.
   */
  formError: () =>
    PageElement.located(By.role('alert')).describedAs(
      'product form error message',
    ),

  /** ASSUMPTION: appends a new, empty component row to the open product form. */
  addComponentButton: () =>
    PageElement.located(
      By.role('button', { name: 'افزودن جز', exact: true }),
    ).describedAs('add component button'),

  /**
   * ASSUMPTION: every component is rendered as its own accessible group (e.g.
   * `<fieldset role="group" aria-label="جز">`), repeated once per component via `*ngFor` — sharing
   * the SAME accessible name on every row, rather than a numbered one, so this collection is
   * addressed *positionally* (`.first()`, `.last()`) instead of the test having to assume a
   * numbering scheme the real markup might not carry. That positional addressing is safe here
   * because every task that reads from this collection either just appended the row it wants
   * (`.last()`, right after clicking `addComponentButton()`) or knows, from how the scenario's own
   * test data was set up, that there is exactly one pre-existing row (`.first()`).
   */
  componentRows: () =>
    PageElements.located(
      By.role('group', { name: 'جز', exact: true }),
    ).describedAs('component rows'),

  /**
   * The labelled picker for a specific component row — scoped with `.of(row)` since every row
   * shares this same label. Confirmed live against the real markup: a component/material can no
   * longer be typed freely (see `frontend/src/app/features/products/product-form-dialog.ts`'s own
   * class-level comment — registering or editing a product never mints a new `Component`/`Material`
   * master row, so the backend now rejects a name that doesn't already resolve to one), so this is a
   * `mat-select`, whose accessible role is `combobox`, not `textbox`. The trigger element itself
   * lives inside this row's DOM (unlike the options it opens — see `openComboBoxOptions()` below),
   * so scoping `.of(row)` still finds it.
   */
  componentNameField: (row: Answerable<PageElement>) =>
    PageElement.located(By.role('combobox', { name: 'اسم جز', exact: true }))
      .of(row)
      .describedAs('component name field'),

  /**
   * ASSUMPTION: removes the component row it's scoped to *from the form* — not a real, persisted
   * delete of a master `components` row (see `delete-component.ts#DeleteComponent` for that).
   */
  removeComponentButton: (row: Answerable<PageElement>) =>
    PageElement.located(By.role('button', { name: 'حذف جز', exact: true }))
      .of(row)
      .describedAs('remove component row button'),

  /** ASSUMPTION: appends a new, empty material row to the component row it's scoped to. */
  addMaterialButton: (componentRow: Answerable<PageElement>) =>
    PageElement.located(
      By.role('button', { name: 'افزودن مواد اولیه', exact: true }),
    )
      .of(componentRow)
      .describedAs('add material button'),

  /** ASSUMPTION: mirrors `componentRows()` one level down — every material row within a given
   * component shares the same accessible group name, addressed positionally the same way. */
  materialRows: (componentRow: Answerable<PageElement>) =>
    PageElements.located(By.role('group', { name: 'مواد اولیه', exact: true }))
      .of(componentRow)
      .describedAs('material rows'),

  /** Same idea as `componentNameField()` one level down — a `mat-select` `combobox`, not a
   * `textbox`. */
  materialNameField: (materialRow: Answerable<PageElement>) =>
    PageElement.located(
      By.role('combobox', { name: 'اسم مواد اولیه', exact: true }),
    )
      .of(materialRow)
      .describedAs('material name field'),

  /**
   * The options rendered by WHICHEVER `mat-select` overlay is currently open — deliberately NOT
   * scoped `.of(row)`, unlike `componentNameField()`/`materialNameField()` above: Angular CDK's
   * overlay container is appended as a sibling of the app root at the end of `<body>`, not nested
   * inside the row that opened it, so a row-scoped locator would never find these. Safe to read
   * unscoped because this suite only ever has one combobox open at a time — the same assumption
   * `screenplay/bom-registration/{bom,standard-bom}-form.ts#SelectOption` already makes when it
   * clicks a freshly-opened option by its global, unscoped locator.
   */
  openComboBoxOptions: () =>
    PageElements.located(By.role('option')).describedAs(
      'options of the open combobox',
    ),

  /** ASSUMPTION: removes the material row it's scoped to *from the form* — not a real, persisted
   * delete of a master `materials` row. */
  removeMaterialButton: (materialRow: Answerable<PageElement>) =>
    PageElement.located(
      By.role('button', { name: 'حذف مواد اولیه', exact: true }),
    )
      .of(materialRow)
      .describedAs('remove material row button'),

  /**
   * ASSUMPTION: the products list renders each product's name as a table cell, mirroring
   * `ComponentsPage.componentNamed()`/`MaterialsPage.materialNamed()`.
   */
  productNamed: (name: string) =>
    PageElement.located(By.role('cell', { name, exact: true })).describedAs(
      `product named "${name}"`,
    ),

  /**
   * ASSUMPTION: a row-level "edit"/"delete" icon button carries the product's own name in its
   * accessible name, mirroring `ComponentsPage.editButton()`/`deleteButton()`.
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
   * the product's name embedded, unlike `deleteButton` above) since only one such dialog can be
   * open at a time.
   */
  confirmDeleteButton: () =>
    PageElement.located(
      By.role('button', { name: 'حذف', exact: true }),
    ).describedAs('confirm delete button'),
};
