import {
  Check,
  d,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  and,
  contain,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  property,
} from '@serenity-js/assertions';
import { LastResponse, PatchRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { ProductsPage } from '../ui/products-page';
import {
  AddComponentWithMaterials,
  AddMaterialsToComponent,
  OpenEditProductForm,
  RemoveAllComponentRows,
  RemoveAllMaterialRowsOf,
  WaitForTheProductFormToBeAnswered,
} from './products-form';
import {
  NewComponentInProduct,
  NewMaterialInComponent,
  NewProductDetails,
  theLastRegisteredProduct,
} from './product-details';
import { theLastRegisteredComponent } from './component-details';
import { TheProductList, ViewProductList } from './view-product-list';

const editRequestBody = (changes: Partial<NewProductDetails>) => {
  const body: Record<string, unknown> = {};
  if (changes.name !== undefined) body.name = changes.name;
  return body;
};

export const EditProduct = {
  /**
   * Edits a product's name through the real "edit product" form — the UI door this feature's
   * top-level "ویرایش می کند" scenario drives. Locates the form by the product's *current* name,
   * since that's what the rendered list still shows until the edit succeeds. Mirrors
   * `screenplay/bom-registration/edit-component.ts#EditComponent.using`.
   */
  using: (currentName: string, changes: Partial<NewProductDetails>): Task =>
    Task.where(
      d`#actor edits the product "${currentName}"`,
      OpenEditProductForm(currentName),
      ...(changes.name !== undefined
        ? [Enter.theValue(changes.name).into(ProductsPage.nameField())]
        : []),
      Click.on(ProductsPage.submitButton()),
      WaitForTheProductFormToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string, changes: Partial<NewProductDetails>): Task =>
    Task.where(
      d`#actor edits product ${id} (via API)`,
      Send.a(PatchRequest.to(`products/${id}`).with(editRequestBody(changes))),
    ),
};

/** Through the UI, assert what the visitor sees: the edited name in the rendered list. */
export const EnsureProductWasEditedWith = (
  changes: Partial<NewProductDetails>,
): Task => {
  if (changes.name === undefined) {
    throw new Error(
      'EnsureProductWasEditedWith expects a "name" change — name is the only field this feature ' +
        'edits.',
    );
  }
  const newName = changes.name;
  return Task.where(
    d`#actor ensures the product was edited to "${newName}"`,
    Wait.until(ProductsPage.productNamed(newName), isVisible()),
  );
};

/**
 * Door-agnostic on purpose, the same way
 * `screenplay/bom-registration/edit-component.ts#EnsureComponentWasNotEdited` is: this feature's
 * "محصول ویرایش نشده باشد" step follows an API-driven attempt (access-denied) as well as a
 * UI-driven one (deleting all components), so rather than reading `LastResponse` it re-queries the
 * system and checks the one fact that matters regardless of door — the product
 * `theLastRegisteredProduct()` names is still exactly as it was.
 *
 * As in the register equivalent, the re-query is skipped when `LastResponse` already reports an
 * error (> 399) — the access-denied rule's API-driven attempt.
 */
export const EnsureProductWasNotEdited = (): Task => {
  const target = theLastRegisteredProduct();
  return Task.where(
    d`#actor ensures "${target.name}" was not edited`,
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewProductList(),
        Ensure.that(
          TheProductList(),
          containAtLeastOneItemThat(
            and(
              property('id', equals(target.id)),
              property('name', equals(target.name)),
            ),
          ),
        ),
      ),
  );
};

/**
 * The "{actor} جز جدیدی برای آن محصول ثبت می کند" step: opens the edit form for an already
 * registered product and drafts a new component row (with whatever materials `details` carries,
 * possibly none) — without submitting yet. Mirrors the two-step drafting shape
 * `screenplay/bom-registration/register-component.ts#EnterNewComponentDetails` establishes: the
 * step that follows (`AttemptToRegisterComponentWithNoMaterials`) is what actually submits.
 */
export const RegisterComponentForProduct = (
  productName: string,
  details: NewComponentInProduct,
): Task =>
  Task.where(
    d`#actor registers a new component "${details.name}" for "${productName}", without submitting yet`,
    OpenEditProductForm(productName),
    AddComponentWithMaterials(details),
  );

/** The "اما هیچ مواد اولیه ای برای جز ثبت نمی کند" step: submits the already-open edit form. */
export const AttemptToRegisterComponentWithNoMaterials = (): Task =>
  Task.where(
    '#actor attempts to register the new component with no materials',
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

/** The "{actor} تمام اجزای آن محصول را حذف می کند" step. */
export const DeleteAllComponentsOfProduct = (productName: string): Task =>
  Task.where(
    d`#actor deletes all components of "${productName}"`,
    OpenEditProductForm(productName),
    RemoveAllComponentRows(),
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

/**
 * The "{actor} تمام مواد اولیه آن جز را حذف می کند" step. The target product's only component is
 * addressed positionally (`ProductsPage.componentRows().first()`) — safe because the scenario's own
 * `Given` ("اینکه یک جز با حداقل یک مواد اولیه در سیستم ثبت شده باشد") always sets up a product
 * with exactly one component.
 */
export const DeleteAllMaterialsOfComponent = (productName: string): Task =>
  Task.where(
    d`#actor deletes all materials of the only component of "${productName}"`,
    OpenEditProductForm(productName),
    RemoveAllMaterialRowsOf(ProductsPage.componentRows().first()),
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

/** The "{actor} چند جز برای آن محصول ثبت می کند" step. */
export const RegisterMultipleComponentsForProduct = (
  productName: string,
  components: NewComponentInProduct[],
): Task =>
  Task.where(
    d`#actor registers multiple new components for "${productName}"`,
    OpenEditProductForm(productName),
    ...components.map((component) => AddComponentWithMaterials(component)),
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

/**
 * The "{actor} چند مواد اولیه برای آن جز ثبت می کند" step. The target component is addressed
 * positionally the same way `DeleteAllMaterialsOfComponent` is, for the same reason: the scenario's
 * own `Given` always sets up a product with exactly one component.
 */
export const RegisterMultipleMaterialsForComponent = (
  productName: string,
  materials: NewMaterialInComponent[],
): Task =>
  Task.where(
    d`#actor registers multiple new materials for a component of "${productName}"`,
    OpenEditProductForm(productName),
    AddMaterialsToComponent(ProductsPage.componentRows().first(), materials),
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

const TheComponentNamesOfProduct = (
  productId: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the component names of product ${productId}`,
    async (actor) => {
      const products = await actor.answer(TheProductList());
      const product = products.find((p) => p.id === productId);
      return product ? product.components.map((c) => c.name) : [];
    },
  );

/** "انتظار می رود تمام اجزای ثبت شده به محصول مربوط باشند" */
export const EnsureAllRegisteredComponentsBelongToProduct = (
  componentNames: string[],
): Task => {
  const target = theLastRegisteredProduct();
  return Task.where(
    '#actor ensures all registered components belong to the product',
    ViewProductList(),
    ...componentNames.map((name) =>
      Ensure.that(TheComponentNamesOfProduct(target.id), contain(name)),
    ),
  );
};

const TheMaterialNamesOfComponent = (
  productId: string,
  componentId: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the material names of component ${componentId}`,
    async (actor) => {
      const products = await actor.answer(TheProductList());
      const product = products.find((p) => p.id === productId);
      const component = product?.components.find((c) => c.id === componentId);
      return component ? component.materials.map((m) => m.name) : [];
    },
  );

/** "انتظار می رود تمام مواد اولیه ثبت شده به جز مربوط باشند" */
export const EnsureAllRegisteredMaterialsBelongToComponent = (
  materialNames: string[],
): Task => {
  const product = theLastRegisteredProduct();
  const component = theLastRegisteredComponent();
  return Task.where(
    '#actor ensures all registered materials belong to the component',
    ViewProductList(),
    ...materialNames.map((name) =>
      Ensure.that(
        TheMaterialNamesOfComponent(product.id, component.id),
        contain(name),
      ),
    ),
  );
};
