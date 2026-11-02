import { d, Interaction, Question, Task } from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isLessThan,
  not,
  property,
} from '@serenity-js/assertions';
import { LastResponse, PatchRequest, Send } from '@serenity-js/rest';
import { Click, Enter } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import { taskDependingOn } from '../common/task-depending-on';
import { freshMaterialDetails } from './material-details';
import {
  RegisterMaterial,
  RegisterMaterialAndRememberIt,
} from './register-material';
import { freshComponentDetails } from './component-details';
import { RegisterComponentAndRememberIt } from './register-component';
import {
  freshComponentInProduct,
  freshMaterialInComponent,
  freshProductDetails,
  theProductRegisteredWithName,
} from './product-details';
import {
  RegisterProductAndRememberIt,
  RegisterProductUnlessRegistered,
} from './register-product';
import { DeleteProduct } from './delete-product';
import {
  ProductSummary,
  TheProductList,
  ViewProductList,
} from './view-product-list';
import {
  RegisterStandardBomAndRememberIt,
  RegisterStandardBomWithMiCodeUnlessRegistered,
} from './register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from './standard-bom-details';
import {
  StandardBomSummary,
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';
import { RegisterBomAndRememberIt } from './register-bom';
import { TheMaterialList, ViewMaterialList } from './view-material-list';
import { TheComponentList, ViewComponentList } from './view-component-list';
import {
  OpenEditStandardBomForm,
  WaitForTheStandardBomFormToBeAnswered,
} from './standard-bom-form';
import { withLatinDigits } from '../common/persian-digits';

/**
 * Issue #94 in bom-registration: which records use which, set up over the API as preconditions,
 * and read back over the API as facts. A material or component is "used" by the product whose
 * composition names it (and by any standard or daily BOM cloned from that product); a product by
 * its standard BOMs; a standard BOM by its daily BOMs.
 *
 * Every task here is meant to be performed by the system admin (`common/observer.ts
 * #performAsTheSystemAdmin`), so the actor under test keeps their own last response and spotlight.
 *
 * Names in these scenarios are fixed («مسی», «مغزی», «کابل NYY»), not fresh: a product's
 * composition is resolved by name, and registering a product first registers every component and
 * material it names (`products-form.ts#RegisterUnderlyingComponentsAndMaterials`) — one that already
 * exists is simply refused as a duplicate there and resolved by name in the product.
 */

// ---------------------------------------------------------------------------------------------
// Preconditions

/** «مواد اولیه «…» (با کد «…») در سیستم ثبت شده باشد» */
export const RegisterMaterialNamed = (name: string, code?: string): Task =>
  Task.where(
    d`#actor registers the material "${name}"`,
    RegisterMaterialAndRememberIt(
      freshMaterialDetails(code === undefined ? { name } : { name, code }),
    ),
    Ensure.that(LastResponse.status(), equals(201)),
  );

/** «جز «…» در سیستم ثبت شده باشد» */
export const RegisterComponentNamed = (name: string): Task =>
  Task.where(
    d`#actor registers the component "${name}"`,
    RegisterComponentAndRememberIt(freshComponentDetails({ name })),
    Ensure.that(LastResponse.status(), equals(201)),
  );

/** A product of exactly one component holding exactly one material — the smallest composition
 * that makes the product use both. */
export const RegisterProductComposedOf = (
  productName: string,
  componentName: string,
  materialName: string,
): Task =>
  Task.where(
    d`#actor registers product "${productName}" of component "${componentName}" holding material "${materialName}"`,
    RegisterProductAndRememberIt(
      freshProductDetails({
        name: productName,
        components: [
          {
            name: componentName,
            materials: [freshMaterialInComponent({ name: materialName })],
          },
        ],
      }),
    ),
    Ensure.that(LastResponse.status(), equals(201)),
  );

/** A fresh-named product using the component and material, and a standard BOM `miCode` cloning
 * it. That product stays: a standard BOM's composition is cloned from its product, so nothing
 * public can leave a material on a standard BOM alone (the design's note on this example). */
export const RegisterStandardBomUsing = (
  componentName: string,
  materialName: string,
  miCode: string,
): Task => {
  const productName = freshProductDetails().name;
  return Task.where(
    d`#actor registers standard BOM "${miCode}" using component "${componentName}" and material "${materialName}"`,
    RegisterProductComposedOf(productName, componentName, materialName),
    RegisterStandardBomForProductNamed(productName, miCode),
  );
};

/** A standard BOM `miCode` cloning the product registered as `productName` in this scenario. */
export const RegisterStandardBomForProductNamed = (
  productName: string,
  miCode: string,
): Task =>
  taskDependingOn(
    `#actor registers standard BOM "${miCode}" for product "${productName}"`,
    Question.about(`product "${productName}"`, () =>
      theProductRegisteredWithName(productName),
    ),
    (product) => [RegisterStandardBomAndRememberIt(product, { miCode })],
  );

/** «آنالیز استاندارد «…» برای محصول «…» ثبت شده باشد» — the product too, unless an earlier step
 * registered it. */
export const RegisterStandardBomForProduct = (
  miCode: string,
  productName: string,
): Task =>
  Task.where(
    d`#actor registers standard BOM "${miCode}" for product "${productName}"`,
    RegisterProductUnlessRegistered(freshProductDetails({ name: productName })),
    RegisterStandardBomForProductNamed(productName, miCode),
  );

/** «آنالیز روزانه «…» با کد MI «…» ثبت شده باشد» — the standard BOM too, unless already there. */
export const RegisterDailyBomOnStandardBom = (
  orderNumber: string,
  miCode: string,
): Task =>
  Task.where(
    d`#actor registers daily BOM "${orderNumber}" on standard BOM "${miCode}"`,
    RegisterStandardBomWithMiCodeUnlessRegistered(miCode),
    taskDependingOn(
      `#actor registers daily BOM "${orderNumber}"`,
      Question.about(`standard BOM "${miCode}"`, () =>
        theStandardBomRegisteredWithMiCode(miCode),
      ),
      (standardBom) => [RegisterBomAndRememberIt(standardBom, { orderNumber })],
    ),
  );

/** «محصول «…» حذف شده باشد» */
export const DeleteProductNamed = (name: string): Task =>
  taskDependingOn(
    `#actor deletes product "${name}"`,
    Question.about(`product "${name}"`, () =>
      theProductRegisteredWithName(name),
    ),
    (product) => [
      DeleteProduct.viaApiUsing(product.id),
      Ensure.that(LastResponse.status(), isLessThan(300)),
    ],
  );

/** A product's composition as the products list reports it, by name only. */
interface CompositionByName {
  name: string;
  materials: string[];
}

const compositionOf = (product: ProductSummary): CompositionByName[] =>
  product.components.map((component) => ({
    name: component.name,
    materials: component.materials.map((material) => material.name),
  }));

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

/** «مواد اولیه «…» در جز «…» محصول «…» با «…» جایگزین شده باشد» — the replacement registered, then
 * the product's whole composition sent back with that one line swapped (`PATCH products/:id`). */
export const ReplaceMaterialInComponentOfProduct = (
  materialName: string,
  replacementName: string,
  componentName: string,
  productName: string,
): Task =>
  Task.where(
    d`#actor replaces "${materialName}" with "${replacementName}" in component "${componentName}" of product "${productName}"`,
    RegisterMaterial.viaApiUsing(
      freshMaterialDetails({ name: replacementName }),
    ),
    ViewProductList(),
    Interaction.where(
      d`#actor sends the product's composition with "${replacementName}" in place of "${materialName}"`,
      async (actor) => {
        const product = theProductNamed(
          await actor.answer(TheProductList()),
          productName,
        );
        await Send.a(
          PatchRequest.to(`products/${product.id}`).with({
            components: compositionOf(product).map((component) => ({
              name: component.name,
              materials: component.materials.map((name) => ({
                name:
                  component.name === componentName && name === materialName
                    ? replacementName
                    : name,
              })),
            })),
          }),
        ).performAs(actor);
      },
    ),
    Ensure.that(LastResponse.status(), isLessThan(300)),
  );

/** «برای محصول «…» هیچ آنالیز استانداردی ثبت نشده باشد» — checked, not arranged: no step before it
 * registers one. */
export const EnsureProductHasNoStandardBom = (productName: string): Task =>
  Task.where(
    d`#actor ensures product "${productName}" has no standard BOM`,
    ViewProductList(),
    taskDependingOn(
      `#actor checks the standard BOMs of product "${productName}"`,
      Question.about(`product "${productName}"`, async (actor) =>
        theProductNamed(await actor.answer(TheProductList()), productName),
      ),
      (product) => [
        ViewStandardBomList(),
        Ensure.that(
          TheStandardBomList(),
          not(
            containAtLeastOneItemThat(
              property('productId', equals(product.id)),
            ),
          ),
        ),
      ],
    ),
  );

/** ««…» در هیچ محصول یا آنالیز استانداردی استفاده نشده باشد» — no product and no standard BOM
 * names it, as a component or as a material. */
export const EnsureNothingUses = (name: string): Task =>
  Task.where(
    d`#actor ensures no product or standard BOM uses "${name}"`,
    ViewProductList(),
    Ensure.that(
      Question.about('the names products are composed of', async (actor) =>
        namesComposing(await actor.answer(TheProductList())),
      ),
      not(containAtLeastOneItemThat(equals(name))),
    ),
    ViewStandardBomList(),
    Ensure.that(
      Question.about('the names standard BOMs are composed of', async (actor) =>
        namesComposing(await actor.answer(TheStandardBomList())),
      ),
      not(containAtLeastOneItemThat(equals(name))),
    ),
  );

const namesComposing = (
  records: Array<ProductSummary | StandardBomSummary>,
): string[] =>
  records.flatMap((record) =>
    record.components.flatMap((component) => [
      component.name,
      ...component.materials.map((material) => material.name),
    ]),
  );

/** A product of a fresh component holding `materialName`, for each of `productNames`. */
export const RegisterProductsUsingMaterial = (
  materialName: string,
  productNames: string[],
): Task =>
  Task.where(
    d`#actor registers products ${productNames} using material "${materialName}"`,
    ...productNames.map((productName) =>
      RegisterProductComposedOf(
        productName,
        freshComponentInProduct().name,
        materialName,
      ),
    ),
  );

// ---------------------------------------------------------------------------------------------
// Facts

export const EnsureMaterialIsRegistered = (name: string, code?: string) =>
  Task.where(
    d`#actor ensures material "${name}" is registered`,
    ViewMaterialList(),
    Ensure.that(
      TheMaterialList(),
      containAtLeastOneItemThat(
        code === undefined
          ? property('name', equals(name))
          : and(
              property('name', equals(name)),
              property('code', equals<string | null>(code)),
            ),
      ),
    ),
  );

export const EnsureMaterialIsGone = (name: string): Task =>
  Task.where(
    d`#actor ensures material "${name}" is gone`,
    ViewMaterialList(),
    Ensure.that(
      TheMaterialList(),
      not(containAtLeastOneItemThat(property('name', equals(name)))),
    ),
  );

export const EnsureComponentIsRegistered = (name: string): Task =>
  Task.where(
    d`#actor ensures component "${name}" is registered`,
    ViewComponentList(),
    Ensure.that(
      TheComponentList(),
      containAtLeastOneItemThat(property('name', equals(name))),
    ),
  );

export const EnsureComponentIsGone = (name: string): Task =>
  Task.where(
    d`#actor ensures component "${name}" is gone`,
    ViewComponentList(),
    Ensure.that(
      TheComponentList(),
      not(containAtLeastOneItemThat(property('name', equals(name)))),
    ),
  );

export const EnsureProductIsRegistered = (name: string): Task =>
  Task.where(
    d`#actor ensures product "${name}" is registered`,
    ViewProductList(),
    Ensure.that(
      TheProductList(),
      containAtLeastOneItemThat(property('name', equals(name))),
    ),
  );

export const EnsureProductIsGone = (name: string): Task =>
  Task.where(
    d`#actor ensures product "${name}" is gone`,
    ViewProductList(),
    Ensure.that(
      TheProductList(),
      not(containAtLeastOneItemThat(property('name', equals(name)))),
    ),
  );

// ---------------------------------------------------------------------------------------------
// What an attempt is measured against
//
// «… ویرایش نشده باشد» / «ترکیب … تغییر نکرده باشد» compare the record with how it was just before
// the attempt — noted by the system admin in the attempt's own step, since the Gherkin states only
// a name.

let compositionBeforeTheAttempt: CompositionByName[] | undefined;
let standardBomBeforeTheAttempt: StandardBomSummary | undefined;

const sameMiCode = (a: string, b: string): boolean =>
  withLatinDigits(a) === withLatinDigits(b);

const theStandardBomWithMiCode = (
  standardBoms: StandardBomSummary[],
  miCode: string,
): StandardBomSummary | undefined =>
  standardBoms.find((candidate) => sameMiCode(candidate.miCode, miCode));

export const NoteTheCompositionOfProduct = (productName: string): Task =>
  Task.where(
    d`#actor notes the composition of product "${productName}"`,
    ViewProductList(),
    Interaction.where(
      d`#actor remembers the composition of product "${productName}"`,
      async (actor) => {
        compositionBeforeTheAttempt = compositionOf(
          theProductNamed(await actor.answer(TheProductList()), productName),
        );
      },
    ),
  );

/** «ترکیب محصول «…» تغییر نکرده باشد» */
export const EnsureCompositionOfProductIsUnchanged = (
  productName: string,
): Task =>
  Task.where(
    d`#actor ensures the composition of product "${productName}" is unchanged`,
    ViewProductList(),
    Ensure.that(
      Question.about(
        d`the composition of product "${productName}"`,
        async (actor) =>
          compositionOf(
            theProductNamed(await actor.answer(TheProductList()), productName),
          ),
      ),
      equals(theNoted(compositionBeforeTheAttempt, 'product composition')),
    ),
  );

export const NoteTheStandardBom = (miCode: string): Task =>
  Task.where(
    d`#actor notes standard BOM "${miCode}"`,
    ViewStandardBomList(),
    Interaction.where(
      d`#actor remembers standard BOM "${miCode}"`,
      async (actor) => {
        standardBomBeforeTheAttempt = theStandardBomWithMiCode(
          await actor.answer(TheStandardBomList()),
          miCode,
        );
      },
    ),
  );

/** «آنالیز استاندارد «…» ویرایش نشده باشد» — still there under its MI code, exactly as noted. */
export const EnsureStandardBomIsUnchanged = (miCode: string): Task =>
  Task.where(
    d`#actor ensures standard BOM "${miCode}" is unchanged`,
    ViewStandardBomList(),
    Ensure.that(
      Question.about(d`standard BOM "${miCode}"`, async (actor) =>
        theStandardBomWithMiCode(
          await actor.answer(TheStandardBomList()),
          miCode,
        ),
      ),
      equals<StandardBomSummary | undefined>(
        theNoted(standardBomBeforeTheAttempt, 'standard BOM'),
      ),
    ),
  );

/** «آنالیز استاندارد «…» از سیستم حذف نشده باشد» */
export const EnsureStandardBomIsRegistered = (miCode: string): Task =>
  Task.where(
    d`#actor ensures standard BOM "${miCode}" is registered`,
    ViewStandardBomList(),
    Ensure.that(
      Question.about(
        d`whether standard BOM "${miCode}" exists`,
        async (actor) =>
          theStandardBomWithMiCode(
            await actor.answer(TheStandardBomList()),
            miCode,
          ) !== undefined,
      ),
      equals(true),
    ),
  );

const theNoted = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) {
    throw new Error(
      `No ${what} was noted before the attempt this step judges — expected the attempt's step to ` +
        'note it first.',
    );
  }
  return value;
};

// ---------------------------------------------------------------------------------------------
// The browser door, where no existing task covers the change

/**
 * «… تلاش می کند وزن های استاندارد آنالیز استاندارد «…» را تغییر دهد» — the edit form, one
 * material's standard weight changed (one is a change of the weights), submitted. The material is
 * found from the standard BOM noted before the attempt (`NoteTheStandardBom`): the form reaches a
 * weight field by its material's name.
 */
export const ChangeAStandardWeightOf = (miCode: string): Task =>
  taskDependingOn(
    `#actor changes a standard weight of standard BOM "${miCode}"`,
    Question.about(d`a material line of standard BOM "${miCode}"`, () => {
      const material = theNoted(standardBomBeforeTheAttempt, 'standard BOM')
        .components[0]?.materials[0];
      if (!material) {
        throw new Error(`Standard BOM "${miCode}" has no material line.`);
      }
      return material;
    }),
    (material) => [
      OpenEditStandardBomForm(miCode),
      Enter.theValue(String(material.weight + 1)).into(
        StandardBomsPage.weightField(material.name),
      ),
      Click.on(StandardBomsPage.submitButton()),
      WaitForTheStandardBomFormToBeAnswered(),
    ],
  );
