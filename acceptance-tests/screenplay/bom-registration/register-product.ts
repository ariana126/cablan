import {
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import { Ensure, isGreaterThan, isLessThan } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { ProductsPage } from '../ui/products-page';
import {
  AddComponentWithMaterials,
  OpenNewProductForm,
  WaitForTheProductFormToBeAnswered,
} from './products-form';
import {
  NewProductDetails,
  rememberRegisteredProduct,
  theAttempt,
} from './product-details';
import { rememberRegisteredComponent } from './component-details';
import { TheProductList, ViewProductList } from './view-product-list';

const registerRequestBody = (details: NewProductDetails) => ({
  name: details.name,
  components: details.components.map((component) => ({
    name: component.name,
    materials: component.materials.map((material) => ({
      name: material.name,
    })),
  })),
});

export const RegisterProduct = {
  /**
   * Registers a product — with all of its components and their materials — through the real "new
   * product" form: the UI door this feature's top-level "ثبت می کند" scenario drives, mirroring
   * `screenplay/bom-registration/register-component.ts#RegisterComponent.using`.
   */
  using: (details: NewProductDetails): Task =>
    Task.where(
      d`#actor registers a new product "${details.name}"`,
      OpenNewProductForm(),
      Enter.theValue(details.name).into(ProductsPage.nameField()),
      ...details.components.map((component) =>
        AddComponentWithMaterials(component),
      ),
      Click.on(ProductsPage.submitButton()),
      WaitForTheProductFormToBeAnswered(),
    ),

  /** The API door — used for background test-data setup and the access-denied "تلاش می کند" rule. */
  viaApiUsing: (details: NewProductDetails): Task =>
    Task.where(
      d`#actor registers a new product "${details.name}" (via API)`,
      Send.a(PostRequest.to('products').with(registerRequestBody(details))),
    ),
};

interface RegisteredProductResponseBody {
  id: string;
  name: string;
  components: Array<{ id: string; name: string }>;
}

/**
 * Remembers both the product itself and each of its just-created components — the latter via
 * `component-details.ts`'s own registry, since those components are real rows in the master
 * `components` table (see the dispatch's "domain shape" note) and several of this feature's
 * scenarios go on to address one of them directly, reusing
 * `edit-component.ts#EnsureComponentWasNotEdited`/`register-component.ts#EnsureNewComponentWasNotRegistered`
 * exactly as `registring-component.feature`'s own scenarios do.
 */
const RememberTheRegisteredProductAndItsComponents = (
  details: NewProductDetails,
): Interaction =>
  Interaction.where(
    d`#actor remembers "${details.name}" and its components as targets`,
    async (actor) => {
      // Confirmed against the dispatch's HTTP surface: `POST /api/products` answers `201` with
      // `{ id, name, components: [{ id, name, materials: [...] }] }`.
      const body = await actor.answer(
        LastResponse.body<RegisteredProductResponseBody>(),
      );
      rememberRegisteredProduct({ id: body.id, name: details.name });
      body.components.forEach((component, index) => {
        const attempted = details.components[index];
        if (attempted) {
          rememberRegisteredComponent({
            id: component.id,
            name: attempted.name,
          });
        }
      });
    },
  );

/**
 * Registers a product via the API and remembers it — and its components — as the scenario's
 * targets, for scenarios that go on to edit or delete the product, or one of its components,
 * possibly as a *different* actor than the one performing this task. Used for `Given`
 * (passive-voiced) preconditions only; the feature's active-voiced scenarios drive the UI instead.
 */
export const RegisterProductAndRememberIt = (
  details: NewProductDetails,
): Task =>
  Task.where(
    d`#actor registers "${details.name}" and remembers it (and its components) as targets`,
    RegisterProduct.viaApiUsing(details),
    RememberTheRegisteredProductAndItsComponents(details),
  );

/** Through the UI, assert what the visitor sees: the new product's name in the rendered list. */
export const EnsureProductWasRegistered = (details: NewProductDetails): Task =>
  Task.where(
    d`#actor ensures "${details.name}" was registered`,
    Wait.until(ProductsPage.productNamed(details.name), isVisible()),
  );

const CountOfProductsNamed = (name: string): QuestionAdapter<number> =>
  Question.about(`the count of products named "${name}"`, async (actor) => {
    const products = await actor.answer(TheProductList());
    return products.filter((product) => product.name === name).length;
  });

/**
 * Door-agnostic on purpose, mirroring
 * `screenplay/bom-registration/register-component.ts#EnsureNewComponentWasNotRegistered`: this
 * feature's "محصول جدیدی ثبت نشده باشد" step follows both a UI-driven attempt (registered with no
 * components) and an API-driven one (access-denied), so rather than reading `LastResponse` — which
 * the UI-driven caller never populates — this re-queries the system and checks the invariant that
 * actually matters: never more than one product sharing the attempted name.
 *
 * The re-query is skipped when `LastResponse` already reports an error (> 399): that's the
 * access-denied rule's API-driven attempt, whose failed response is the proof the re-query would
 * otherwise reconfirm — skipping it also avoids overwriting `LastResponse` with a GET's 200 before
 * the shared "پیغام خطای عدم دسترسی نشان داده شود" step reads the original attempt's 403 off it.
 */
export const EnsureNewProductWasNotRegistered = (): Task => {
  const attempted = theAttempt<NewProductDetails>();
  return Task.where(
    '#actor ensures a new product was not registered',
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewProductList(),
        Ensure.that(CountOfProductsNamed(attempted.name), isLessThan(2)),
      ),
  );
};

/**
 * Opens the "new product" form and drafts the product's own name — without registering any
 * component yet — the "ثبت محصول بدون جز" example's first step, mirroring
 * `screenplay/bom-registration/register-component.ts#EnterNewComponentDetails`.
 */
export const EnterNewProductDetails = (details: NewProductDetails): Task =>
  Task.where(
    '#actor enters new product details, without registering any components yet',
    OpenNewProductForm(),
    Enter.theValue(details.name).into(ProductsPage.nameField()),
  );

/** The "اما هیچ جزئی برای محصول ثبت نمی کند" step: submits the already-open, component-less form. */
export const AttemptToRegisterProductWithNoComponents = (): Task =>
  Task.where(
    '#actor attempts to register a new product with no components',
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );
