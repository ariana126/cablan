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
   * ASSUMPTION: the labelled name field inside whichever product form/dialog is currently open —
   * the "new product" and "edit product" forms are assumed to share one form component, and
   * therefore this one locator, the same way `ComponentsPage.nameField()`/`MaterialsPage.nameField()`
   * serve both of their respective forms.
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

  /** The labelled name field inside a specific component row — scoped with `.of(row)` since every
   * row shares this same label. */
  componentNameField: (row: Answerable<PageElement>) =>
    PageElement.located(By.role('textbox', { name: 'اسم جز', exact: true }))
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

  materialNameField: (materialRow: Answerable<PageElement>) =>
    PageElement.located(
      By.role('textbox', { name: 'اسم مواد اولیه', exact: true }),
    )
      .of(materialRow)
      .describedAs('material name field'),

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
