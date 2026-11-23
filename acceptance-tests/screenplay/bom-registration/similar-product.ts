import {
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { Click, Enter, isVisible, Value } from '@serenity-js/web';
import { WaitUntil } from '../common/polling';
import { isGone } from '../common/is-gone';
import { ChooseRowAction } from '../common/row-actions';
import { ProductsPage } from '../ui/products-page';
import {
  LocateProductsPage,
  RemoveAllComponentRows,
  WaitForTheProductFormToBeAnswered,
} from './products-form';
import { DeclineTheStandardBomOffer } from './standard-bom-offer';
import {
  ProductSummary,
  TheProductList,
  ViewProductList,
} from './view-product-list';

/**
 * Issue #133 — «تعریف محصول مشابه»: a new, independent product registered from an existing one.
 * A `/products` row's menu item opens the ordinary new product form (`POST products` on save,
 * followed by issue #128's standard BOM offer like any new product) with the source's name and its
 * component rows — each component with its materials, in the product's order — already filled in.
 *
 * Every action here is the browser's; the source is noted over the API beforehand (by the step, as
 * یاشار), so «محصول … بدون تغییر …» can compare it with how it stood.
 */

/** A component of the open form, with the materials its rows hold, top to bottom. */
interface FormComponent {
  name: string;
  materials: string[];
}

// ---------------------------------------------------------------------------------------------
// The baseline

const productsNotedBeforeTheAction = new Map<string, ProductSummary>();

/** Notes product `name` as `GET products` reports it — what «… بدون تغییر …» compares with. */
export const NoteTheProduct = (name: string): Task =>
  Task.where(
    d`#actor notes product "${name}"`,
    ViewProductList(),
    Interaction.where(d`#actor remembers product "${name}"`, async (actor) => {
      productsNotedBeforeTheAction.set(
        name,
        theProductNamed(await actor.answer(TheProductList()), name),
      );
    }),
  );

/** «محصول «…» بدون تغییر در سیستم ثبت شده باشد» after a «تعریف محصول مشابه» — the product noted
 * before the action is still there, under its id, with the same name and the same components and
 * materials in the same order. */
export const EnsureProductIsUnchangedSinceNoted = (name: string): Task => {
  const noted = productsNotedBeforeTheAction.get(name);
  if (!noted) {
    throw new Error(
      `Product "${name}" was not noted before the action this step judges — expected the ` +
        "action's step to note it first.",
    );
  }
  return Task.where(
    d`#actor ensures product "${name}" is unchanged since noted`,
    ViewProductList(),
    Ensure.that(
      Question.about(d`product "${name}" (${noted.id})`, async (actor) =>
        (await actor.answer(TheProductList())).find(
          (candidate) => candidate.id === noted.id,
        ),
      ),
      equals<ProductSummary | undefined>(noted),
    ),
  );
};

const theProductNamed = (
  products: ProductSummary[],
  name: string,
): ProductSummary => {
  const product = products.find((candidate) => candidate.name === name);
  if (!product) {
    throw new Error(`No product named "${name}" is registered.`);
  }
  return product;
};

// ---------------------------------------------------------------------------------------------
// The form

/** «… تعریف محصول مشابه «…» را انتخاب می کند» — the source row's menu item, then the new product
 * form it opens (waited for by its heading). */
export const OpenTheSimilarProductFormOf = (sourceName: string): Task =>
  Task.where(
    d`#actor opens the similar product form of "${sourceName}"`,
    LocateProductsPage(),
    ChooseRowAction(sourceName, 'create-similar-product'),
    WaitUntil(ProductsPage.newProductFormHeading(), isVisible()),
  );

/** The same, and then waits until the form holds the source — its name and at least one component
 * row — so what the actor changes next is not overwritten by the form filling itself in. */
const OpenTheFilledSimilarProductFormOf = (sourceName: string): Task =>
  Task.where(
    d`#actor opens the similar product form of "${sourceName}", filled in`,
    OpenTheSimilarProductFormOf(sourceName),
    WaitUntil(Value.of(ProductsPage.nameField()), equals(sourceName)),
    WaitUntil(ProductsPage.componentRows().count(), isGreaterThan(0)),
  );

/** The open product form's components, top to bottom, each with its materials as their pickers
 * show them. */
const TheCompositionOfTheOpenProductForm = (): QuestionAdapter<
  FormComponent[]
> =>
  Question.about('the composition of the open product form', async (actor) => {
    const composition: FormComponent[] = [];
    for (const row of await actor.answer(ProductsPage.componentRows())) {
      const materials: string[] = [];
      for (const materialRow of await actor.answer(
        ProductsPage.materialRows(row),
      )) {
        materials.push(
          await actor.answer(
            Value.of(ProductsPage.materialNameField(materialRow)),
          ),
        );
      }
      composition.push({
        name: await actor.answer(
          Value.of(ProductsPage.componentNameField(row)),
        ),
        materials,
      });
    }
    return composition;
  });

/** «فرم ثبت محصول جدید با نام «…» باز شود» — the new product form (not the edit one), holding that
 * name. */
export const EnsureTheNewProductFormIsOpenWithName = (name: string): Task =>
  Task.where(
    d`#actor ensures the new product form is open with name "${name}"`,
    WaitUntil(ProductsPage.newProductFormHeading(), isVisible()),
    WaitUntil(Value.of(ProductsPage.nameField()), equals(name)),
    Ensure.that(Value.of(ProductsPage.nameField()), equals(name)),
  );

/** «اجزای آن فرم به ترتیب «…» از مواد اولیه «…»، … باشند» — exactly those components, in that
 * order, each holding exactly that one material. */
export const EnsureTheOpenProductFormIsComposedOf = (
  components: Array<{ name: string; material: string }>,
): Task => {
  const expected: FormComponent[] = components.map(({ name, material }) => ({
    name,
    materials: [material],
  }));
  return Task.where(
    d`#actor ensures the open product form is composed of ${expected}`,
    WaitUntil(TheCompositionOfTheOpenProductForm(), equals(expected)),
    Ensure.that(TheCompositionOfTheOpenProductForm(), equals(expected)),
  );
};

/**
 * Saves the open product form and waits for the answer; a saved product closes the form and is
 * followed by issue #128's standard BOM offer, which is declined («خیر», as `RegisterProduct.using`
 * does), so the scenario is not left behind its overlay. A refusal keeps the form open, with no offer.
 */
const SaveTheProductForm = (): Task =>
  Task.where(
    '#actor saves the open product form',
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
    Check.whether(ProductsPage.nameField(), isVisible())
      .andIfSo()
      .otherwise(DeclineTheStandardBomOffer()),
  );

export const RegisterSimilarProduct = {
  /** «… محصول مشابه «…» را با نام «…» ثبت می کند» */
  named: (sourceName: string, newName: string): Task =>
    Task.where(
      d`#actor registers a product similar to "${sourceName}" named "${newName}"`,
      OpenTheFilledSimilarProductFormOf(sourceName),
      Enter.theValue(newName).into(ProductsPage.nameField()),
      SaveTheProductForm(),
    ),

  /** «… محصول مشابه «…» را با نام «…» و بدون جز «…» ثبت می کند» — that component's row removed
   * from the form before saving. */
  namedWithoutComponent: (
    sourceName: string,
    newName: string,
    componentName: string,
  ): Task =>
    Task.where(
      d`#actor registers a product similar to "${sourceName}" named "${newName}" without "${componentName}"`,
      OpenTheFilledSimilarProductFormOf(sourceName),
      Enter.theValue(newName).into(ProductsPage.nameField()),
      Click.on(
        ProductsPage.removeComponentButton(
          ProductsPage.componentRowNamed(componentName),
        ),
      ),
      WaitUntil(ProductsPage.componentRowNamed(componentName), isGone()),
      SaveTheProductForm(),
    ),
};

/** «… تلاش می کند محصول مشابه «…» را پس از حذف تمام اجزای آن ثبت کند» — every component row
 * removed from the filled form, then saved; the form is expected to refuse it. */
export const AttemptToRegisterSimilarProductWithoutComponents = (
  sourceName: string,
): Task =>
  Task.where(
    d`#actor attempts to register a product similar to "${sourceName}" with every component removed`,
    OpenTheFilledSimilarProductFormOf(sourceName),
    RemoveAllComponentRows(),
    WaitUntil(ProductsPage.componentRows().count(), equals(0)),
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

/** «… بدون ذخیره از فرم ثبت محصول انصراف می دهد» — «انصراف», then the form is gone. */
export const CancelTheProductForm = (): Task =>
  Task.where(
    '#actor cancels the product form without saving',
    WaitUntil(ProductsPage.cancelButton(), isVisible()),
    Click.on(ProductsPage.cancelButton()),
    WaitUntil(ProductsPage.newProductFormHeading(), isGone()),
  );
