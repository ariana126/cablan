import {
  Answerable,
  AnswersQuestions,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  UsesAbilities,
  Wait,
} from '@serenity-js/core';
import { contain, Ensure, equals, isLessThan } from '@serenity-js/assertions';
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Value } from '@serenity-js/web';
import { ProductsPage } from '../ui/products-page';
import { readAsTheSystemAdmin } from '../common/observer';
import { withLatinDigits } from '../common/persian-digits';
import { taskDependingOn } from '../common/task-depending-on';
import {
  AddComponentWithMaterials,
  OpenEditProductForm,
  RegisterUnderlyingComponentsAndMaterials,
  WaitForTheProductFormToBeAnswered,
} from './products-form';
import {
  freshMaterialInComponent,
  freshProductDetails,
  NewComponentInProduct,
} from './product-details';
import { RegisterProductAndRememberIt } from './register-product';
import {
  ProductSummary,
  TheProductList,
  ViewProductList,
} from './view-product-list';
import {
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';
import { BomSummary, TheBomList, ViewBomList } from './view-bom-list';

/**
 * Issue #122 — the order of a product's components: the vocabulary of registring-product.feature's
 * order rules and viewing-audit-log.feature's reorder event.
 *
 * There is no endpoint of its own: the order of `components` in `POST products` / `PATCH
 * products/:id` is the order, and every read of a product, a standard BOM or a daily BOM lists its
 * components in it. In the browser, each component row of the product dialogs carries «انتقال <name>
 * به بالا» / «… به پایین» (`ProductsPage.moveComponentUpButton`).
 */

/** «هادی، عایق، روکش» — the component names, in order. */
export const componentOrderFrom = (written: string): string[] =>
  written
    .split(/\s*[،,]\s*/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

/** One component of a product a precondition registers, with the material it names, if any. */
export interface OrderedComponent {
  name: string;
  /** Unstated → a fresh material; the Gherkin only names one where it is the point. */
  material?: string;
}

// ---------------------------------------------------------------------------------------------
// Preconditions

/**
 * «محصول «…» با ترتیب اجزای «…» (از مواد اولیه «…») در سیستم ثبت شده باشد» — over the API, in the
 * order given, every component and material it names registered first (`RegisterProduct
 * .viaApiUsing`; one already registered — «هادی» for a second product — is refused there and
 * resolved by name in the product). Remembered, so «آنالیز استاندارد … برای محصول … ثبت شده باشد»
 * finds it rather than registering another.
 */
export const RegisterProductWithComponentsInOrder = (
  productName: string,
  components: OrderedComponent[],
): Task =>
  Task.where(
    d`#actor registers product "${productName}" with components ${components.map((c) => c.name)} in that order`,
    RegisterProductAndRememberIt(
      freshProductDetails({
        name: productName,
        components: components.map(({ name, material }) => ({
          name,
          materials: [
            freshMaterialInComponent(
              material === undefined ? {} : { name: material },
            ),
          ],
        })),
      }),
    ),
    Ensure.that(LastResponse.status(), equals(201)),
  );

// ---------------------------------------------------------------------------------------------
// Reordering

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

/** The product's own components, permuted into `order` — refusing an order that is not one. */
const componentsOf = (product: ProductSummary, order: string[]) => {
  const reordered = order.map((name) => {
    const component = product.components.find((c) => c.name === name);
    if (!component) {
      throw new Error(`Product "${product.name}" has no component "${name}".`);
    }
    return component;
  });
  if (reordered.length !== product.components.length) {
    throw new Error(
      `${order.join('، ')} is not an order of all of product "${product.name}"'s components ` +
        `(${product.components.map((c) => c.name).join('، ')}).`,
    );
  }
  return reordered;
};

/** The component names of the open product dialog, top to bottom, as their pickers show them. */
const TheComponentOrderInTheOpenForm = (): QuestionAdapter<string[]> =>
  Question.about(
    'the component order in the open product form',
    async (actor) => {
      const rows = await actor.answer(ProductsPage.componentRows());
      const names: string[] = [];
      for (const row of rows) {
        names.push(
          await actor.answer(Value.of(ProductsPage.componentNameField(row))),
        );
      }
      return names;
    },
  );

const sorted = (names: string[]): string[] =>
  [...names].sort((a, b) => a.localeCompare(b));

/**
 * Brings the open dialog's component rows into `order` with the rows' «انتقال … به بالا» buttons:
 * for each place from the top, the component that belongs there is moved up until it is there.
 * The dialog's own order is read first, since that is what a person looks at.
 */
const MoveTheComponentsInto = (order: string[]): Task =>
  Task.where(
    d`#actor moves the components of the open product form into the order ${order}`,
    Wait.until(
      Question.about('the components of the open product form', async (actor) =>
        sorted(await actor.answer(TheComponentOrderInTheOpenForm())),
      ),
      equals(sorted(order)),
    ),
    Interaction.where(
      d`#actor clicks the move-up buttons that give the order ${order}`,
      async (actor) => {
        const current = await actor.answer(TheComponentOrderInTheOpenForm());
        for (let place = 0; place < order.length; place++) {
          let at = current.indexOf(order[place]);
          while (at > place) {
            await moveUp(actor, order[place]);
            [current[at - 1], current[at]] = [current[at], current[at - 1]];
            at -= 1;
          }
        }
      },
    ),
    Wait.until(TheComponentOrderInTheOpenForm(), equals(order)),
  );

const moveUp = (
  actor: UsesAbilities & AnswersQuestions,
  componentName: string,
): Promise<void> =>
  Click.on(ProductsPage.moveComponentUpButton(componentName)).performAs(actor);

/** The product's components in `order`, by name — the composition `PATCH products/:id` takes. */
const ReorderOverTheApi = (productName: string, order: string[]) =>
  Interaction.where(
    d`#actor sends the components of product "${productName}" in the order ${order}`,
    async (actor) => {
      // Read as یاشار: the roles refused the reorder may not read the products either.
      const product = theProductNamed(
        await readAsTheSystemAdmin<ProductSummary[]>('products'),
        productName,
      );
      await Send.a(
        PatchRequest.to(`products/${product.id}`).with({
          components: componentsOf(product, order).map((component) => ({
            name: component.name,
            materials: component.materials.map(({ name }) => ({ name })),
          })),
        }),
      ).performAs(actor);
    },
  );

export const ReorderProductComponents = {
  /** «… ترتیب اجزای محصول «…» را به «…» تغییر می دهد» — the edit dialog, its move buttons, «ثبت». */
  using: (productName: string, order: string[]): Task =>
    Task.where(
      d`#actor puts the components of product "${productName}" in the order ${order}`,
      OpenEditProductForm(productName),
      MoveTheComponentsInto(order),
      Click.on(ProductsPage.submitButton()),
      WaitForTheProductFormToBeAnswered(),
    ),

  /**
   * «… تلاش می کند ترتیب اجزای محصول «…» را به «…» تغییر دهد» and the audit log's precondition —
   * `PATCH products/:id` with the same components and materials, permuted. The actor's last
   * response is that request's.
   */
  viaApiUsing: (productName: string, order: string[]): Task =>
    Task.where(
      d`#actor puts the components of product "${productName}" in the order ${order} (via API)`,
      ReorderOverTheApi(productName, order),
    ),
};

/** A reorder over the API that must succeed — a precondition. */
export const ReorderProductComponentsAsAPrecondition = (
  productName: string,
  order: string[],
): Task =>
  Task.where(
    d`#actor has put the components of product "${productName}" in the order ${order}`,
    ReorderProductComponents.viaApiUsing(productName, order),
    Ensure.that(LastResponse.status(), isLessThan(300)),
  );

/**
 * «… در یک ویرایش ترتیب اجزای محصول «…» را به «…» تغییر دهد و جز «…» را به آن اضافه کند» — one
 * edit dialog: the rows moved, then the new component (registered before the dialog opens —
 * `products-form.ts#RegisterUnderlyingComponentsAndMaterials`) added last, then «ثبت».
 */
export const ReorderAndAddComponent = (
  productName: string,
  order: string[],
  component: NewComponentInProduct,
): Task =>
  Task.where(
    d`#actor puts the components of product "${productName}" in the order ${order} and adds component "${component.name}" in one edit`,
    RegisterUnderlyingComponentsAndMaterials([component]),
    OpenEditProductForm(productName),
    MoveTheComponentsInto(order),
    AddComponentWithMaterials(component),
    Click.on(ProductsPage.submitButton()),
    WaitForTheProductFormToBeAnswered(),
  );

// ---------------------------------------------------------------------------------------------
// Facts — performed by the system admin (`common/observer.ts#performAsTheSystemAdmin`)

const namesOf = (components: Array<{ name: string }>): string[] =>
  components.map((component) => component.name);

const TheComponentOrderOfProduct = (
  productName: string,
): QuestionAdapter<string[]> =>
  Question.about(
    d`the component order of product "${productName}"`,
    async (actor) =>
      namesOf(
        theProductNamed(await actor.answer(TheProductList()), productName)
          .components,
      ),
  );

/** «ترتیب اجزای محصول «…» «…» باشد» — `GET products`. */
export const EnsureComponentOrderOfProduct = (
  productName: string,
  order: string[],
): Task =>
  Task.where(
    d`#actor ensures the components of product "${productName}" are in the order ${order}`,
    ViewProductList(),
    Ensure.that(TheComponentOrderOfProduct(productName), equals(order)),
  );

/** «مواد اولیه «…» در جز «…» … محصول «…» باشند» — one pair: the component kept its material. */
export const EnsureComponentOfProductHoldsMaterial = (
  productName: string,
  componentName: string,
  materialName: string,
): Task =>
  Task.where(
    d`#actor ensures component "${componentName}" of product "${productName}" holds material "${materialName}"`,
    ViewProductList(),
    Ensure.that(
      Question.about(
        d`the materials of component "${componentName}" of product "${productName}"`,
        async (actor) => {
          const component = theProductNamed(
            await actor.answer(TheProductList()),
            productName,
          ).components.find((candidate) => candidate.name === componentName);
          return component ? namesOf(component.materials) : [];
        },
      ),
      contain(materialName),
    ),
  );

/** «ترتیب اجزای آنالیز استاندارد «…» «…» باشد» — `GET standard-boms`. */
export const EnsureComponentOrderOfStandardBom = (
  miCode: string,
  order: string[],
): Task =>
  Task.where(
    d`#actor ensures the components of standard BOM "${miCode}" are in the order ${order}`,
    ViewStandardBomList(),
    Ensure.that(
      Question.about(
        d`the component order of standard BOM "${miCode}"`,
        async (actor) => {
          const standardBom = (await actor.answer(TheStandardBomList())).find(
            (candidate) =>
              withLatinDigits(candidate.miCode) === withLatinDigits(miCode),
          );
          if (!standardBom) {
            throw new Error(`No standard BOM "${miCode}" is registered.`);
          }
          return namesOf(standardBom.components);
        },
      ),
      equals(order),
    ),
  );

const TheIdOfTheDailyBom = (orderNumber: string): Answerable<string> =>
  Question.about(d`the id of daily BOM "${orderNumber}"`, async (actor) => {
    const bom = (await actor.answer(TheBomList())).find(
      (candidate) =>
        withLatinDigits(candidate.orderNumber) === withLatinDigits(orderNumber),
    );
    if (!bom) {
      throw new Error(`No daily BOM "${orderNumber}" is registered.`);
    }
    return bom.id;
  });

/** «ترتیب اجزای آنالیز روزانه «…» «…» باشد» — `GET boms/:id`. */
export const EnsureComponentOrderOfDailyBom = (
  orderNumber: string,
  order: string[],
): Task =>
  Task.where(
    d`#actor ensures the components of daily BOM "${orderNumber}" are in the order ${order}`,
    ViewBomList(),
    taskDependingOn(
      `#actor reads daily BOM "${orderNumber}"`,
      TheIdOfTheDailyBom(orderNumber),
      (id) => [
        Send.a(GetRequest.to(`boms/${id}`)),
        Ensure.that(LastResponse.status(), equals(200)),
        Ensure.that(
          Question.about(
            d`the component order of daily BOM "${orderNumber}"`,
            async (actor) =>
              namesOf(
                (
                  await actor.answer(
                    LastResponse.body<Pick<BomSummary, 'components'>>(),
                  )
                ).components,
              ),
          ),
          equals(order),
        ),
      ],
    ),
  );
