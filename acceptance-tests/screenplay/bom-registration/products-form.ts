import {
  Answerable,
  d,
  Interaction,
  notes,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  Click,
  Enter,
  isVisible,
  Navigate,
  PageElement,
} from '@serenity-js/web';
import { ProductsPage } from '../ui/products-page';
import { AuthNotes, LogIn } from '../common/login';
import { PersonaCredentialsNotes } from '../common/personas';
import {
  NewComponentInProduct,
  NewMaterialInComponent,
} from './product-details';

/**
 * Establishes a real browser session before the products page is ever navigated to. Mirrors
 * `screenplay/bom-registration/materials-form.ts#EstablishBrowserSession` — see that module's
 * comment for the full reasoning: the scenario's background only authenticates the actor's
 * `CallAnApi` ability, so a UI-driving product task needs its own real `/login` visit first.
 */
const EstablishBrowserSession = (): Task =>
  Task.where(
    '#actor establishes a browser session for the products UI',
    LogIn.using(
      notes<AuthNotes>().get('username'),
      notes<PersonaCredentialsNotes>().get('password'),
    ),
  );

/**
 * Navigates to the products page and waits for it to have rendered — the "locate task" every
 * UI-driving product task below starts from. Per this suite's waiting convention, the wait belongs
 * here, in the locate task, not in whatever task follows it.
 */
export const LocateProductsPage = (): Task =>
  Task.where(
    '#actor locates the products page',
    EstablishBrowserSession(),
    Navigate.to('/products'),
    Wait.until(ProductsPage.heading(), isVisible()),
  );

export const OpenNewProductForm = (): Task =>
  Task.where(
    '#actor opens the new product form',
    LocateProductsPage(),
    Click.on(ProductsPage.addButton()),
    Wait.until(ProductsPage.nameField(), isVisible()),
  );

export const OpenEditProductForm = (currentName: string): Task =>
  Task.where(
    d`#actor opens the edit form for "${currentName}"`,
    LocateProductsPage(),
    Wait.until(ProductsPage.editButton(currentName), isVisible()),
    Click.on(ProductsPage.editButton(currentName)),
    Wait.until(ProductsPage.nameField(), isVisible()),
  );

export const OpenDeleteConfirmation = (name: string): Task =>
  Task.where(
    d`#actor opens the delete confirmation for "${name}"`,
    LocateProductsPage(),
    Wait.until(ProductsPage.deleteButton(name), isVisible()),
    Click.on(ProductsPage.deleteButton(name)),
    Wait.until(ProductsPage.confirmDeleteButton(), isVisible()),
  );

/**
 * Submitting a form means clicking *and* waiting for the answer (this suite's waiting convention):
 * polls until either the dialog has closed — the name field is no longer visible, meaning the
 * request succeeded — or the site has told the visitor what was wrong (the form's root-level error
 * banner became visible). Mirrors
 * `screenplay/bom-registration/materials-form.ts#WaitForTheMaterialFormToBeAnswered`.
 */
export const WaitForTheProductFormToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the product form to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const nameField = await actor.answer(ProductsPage.nameField());
        if (!(await nameField.isVisible())) {
          return;
        }
        const error = await actor.answer(ProductsPage.formError());
        if (await error.isVisible()) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/** Same idea as `WaitForTheProductFormToBeAnswered`, for the delete confirmation dialog. */
export const WaitForTheDeleteConfirmationToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the delete confirmation to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const confirmButton = await actor.answer(
          ProductsPage.confirmDeleteButton(),
        );
        if (!(await confirmButton.isVisible())) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

/**
 * Adds materials to an already-open component row, one row per material — the shared building
 * block behind both a brand-new component's materials (`AddComponentWithMaterials` below) and
 * adding further materials to an already-registered component
 * (`edit-product.ts#RegisterMultipleMaterialsForComponent`). An empty `materials` array is a no-op,
 * which is exactly the shape "قانون: هر جز حداقل یک مواد اولیه دارد"'s negative scenario needs.
 *
 * That empty case is handled as its own branch rather than falling through to
 * `Task.where(description, ...materials.flatMap(...))`: with zero materials the `flatMap` produces
 * zero activities, and `Task.where` with zero activities is Serenity/JS's own convention for an
 * *unimplemented* task — it always rejects with `ImplementationPendingError`, which would misreport
 * a deliberate no-op as a gap in this suite's automation. The branch instead returns a `Task.where`
 * guarded by one real (no-op) `Interaction`, so it always has at least one activity.
 */
export const AddMaterialsToComponent = (
  componentRow: Answerable<PageElement>,
  materials: NewMaterialInComponent[],
): Task => {
  if (materials.length === 0) {
    return Task.where(
      '#actor adds materials to a component row',
      Interaction.where(
        '#actor adds no materials, as none were given',
        () => undefined,
      ),
    );
  }
  return Task.where(
    '#actor adds materials to a component row',
    ...materials.flatMap((material) => [
      Click.on(ProductsPage.addMaterialButton(componentRow)),
      Wait.until(
        ProductsPage.materialNameField(
          ProductsPage.materialRows(componentRow).last(),
        ),
        isVisible(),
      ),
      Enter.theValue(material.name).into(
        ProductsPage.materialNameField(
          ProductsPage.materialRows(componentRow).last(),
        ),
      ),
    ]),
  );
};

/**
 * Appends a new component row to the currently-open product form, names it, and adds each of its
 * materials — used both for a brand-new product's components (`register-product.ts#RegisterProduct`)
 * and for adding further components to an already-registered one
 * (`edit-product.ts#RegisterMultipleComponentsForProduct`/`RegisterComponentForProduct`).
 * `details.materials` may be empty, which is exactly the shape "قانون: هر جز حداقل یک مواد اولیه
 * دارد"'s negative scenario needs: a named row with none of its own, submitted deliberately.
 */
export const AddComponentWithMaterials = (
  details: NewComponentInProduct,
): Task =>
  Task.where(
    d`#actor adds component "${details.name}" with its materials to the open product form`,
    Click.on(ProductsPage.addComponentButton()),
    Wait.until(
      ProductsPage.componentNameField(ProductsPage.componentRows().last()),
      isVisible(),
    ),
    Enter.theValue(details.name).into(
      ProductsPage.componentNameField(ProductsPage.componentRows().last()),
    ),
    AddMaterialsToComponent(
      ProductsPage.componentRows().last(),
      details.materials,
    ),
  );

/**
 * Removes every component row currently on the open form, one at a time — "قانون: هر محصول حداقل
 * یک جز دارد"'s negative scenario ("حذف تمام اجزای محصول") drives the form into this deliberately
 * invalid state to prove the backend refuses it.
 */
export const RemoveAllComponentRows = (): Interaction =>
  Interaction.where('#actor removes all component rows', async (actor) => {
    let remaining = await actor.answer(ProductsPage.componentRows().count());
    while (remaining > 0) {
      const row = await actor.answer(ProductsPage.componentRows().first());
      const removeButton = await actor.answer(
        ProductsPage.removeComponentButton(row),
      );
      await removeButton.click();
      remaining -= 1;
    }
  });

/**
 * Removes every material row of a given component row currently on the open form — the same idea
 * as `RemoveAllComponentRows`, one level down, for "قانون: هر جز حداقل یک مواد اولیه دارد"'s
 * negative scenario ("حذف تمام مواد اولیه جز").
 */
export const RemoveAllMaterialRowsOf = (
  componentRow: Answerable<PageElement>,
): Interaction =>
  Interaction.where(
    '#actor removes all material rows of a component',
    async (actor) => {
      let remaining = await actor.answer(
        ProductsPage.materialRows(componentRow).count(),
      );
      while (remaining > 0) {
        const row = await actor.answer(
          ProductsPage.materialRows(componentRow).first(),
        );
        const removeButton = await actor.answer(
          ProductsPage.removeMaterialButton(row),
        );
        await removeButton.click();
        remaining -= 1;
      }
    },
  );

const EnsureProductsFormErrorShown = (description: string): Task =>
  Task.where(description, Wait.until(ProductsPage.formError(), isVisible()));

/** "پیغام خطای حداقل یک جز برای محصول نشان داده شود" — a product submitted/edited with zero components. */
export const EnsureAtLeastOneComponentErrorShown = (): Task =>
  EnsureProductsFormErrorShown(
    '#actor ensures the at-least-one-component error was shown',
  );

/** "پیغام خطای حداقل یک مواد اولیه برای جز نشان داده شود" — a component submitted/edited with zero materials. */
export const EnsureAtLeastOneMaterialErrorShown = (): Task =>
  EnsureProductsFormErrorShown(
    '#actor ensures the at-least-one-material error was shown',
  );
