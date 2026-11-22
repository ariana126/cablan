import { d, Duration, Question, Task, Wait } from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  includes,
  isPresent,
  not,
  property,
} from '@serenity-js/assertions';
import { Click, Enter, isVisible, Text } from '@serenity-js/web';
import { WaitUntil } from '../common/polling';
import { isGone } from '../common/is-gone';
import { taskDependingOn } from '../common/task-depending-on';
import { withLatinDigits } from '../common/persian-digits';
import { ProductsPage } from '../ui/products-page';
import { StandardBomsPage } from '../ui/standard-boms-page';
import { NewProductDetails } from './product-details';
import { TheProductList, ViewProductList } from './view-product-list';
import {
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';
import {
  FillInTheStandardWeightsOfProductNamed,
  SelectOption,
  WaitForTheStandardBomFormToBeAnswered,
} from './standard-bom-form';
import { freshBrand, freshStandardLength } from './standard-bom-details';

/**
 * Issue #128 — after a product is registered through `/products`' new product form, the page
 * offers to define that product's standard BOM on the spot. The vocabulary of the offer: what it
 * asks, accepting it (the standard BOM form opens with the product locked), declining it, and what
 * the system holds afterwards. Every action is the browser's — the offer exists nowhere else; every
 * fact is read over the API (by the step, as یاشار).
 */

/** How long «… پیشنهاد نشود» watches for an offer that should never come. */
const NO_OFFER_WATCH = Duration.ofMilliseconds(1_500);

/** A text as a reader takes it: runs of whitespace (a line break between heading and body) as one
 * space. */
const asRead = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** «از او پرسیده شود «…»» — the offer is on screen, asking exactly that. */
export const EnsureTheStandardBomOfferAsks = (question: string): Task =>
  Task.where(
    d`#actor ensures the standard BOM offer asks "${question}"`,
    WaitUntil(ProductsPage.standardBomOffer(), isVisible()),
    Ensure.that(
      Question.about('what the standard BOM offer says', async (actor) =>
        asRead(await actor.answer(Text.of(ProductsPage.standardBomOffer()))),
      ),
      includes(asRead(question)),
    ),
  );

/**
 * «پیشنهاد تعریف آنالیز استاندارد را می پذیرد» — «بله», then waits for the standard BOM form it
 * opens (by its heading: its first field is an empty text field, which never reads as visible —
 * see acceptance-tests/CLAUDE.md, "Waiting").
 */
export const AcceptTheStandardBomOffer = (): Task =>
  Task.where(
    '#actor accepts the offer to define a standard BOM',
    WaitUntil(ProductsPage.acceptStandardBomOfferButton(), isVisible()),
    Click.on(ProductsPage.acceptStandardBomOfferButton()),
    WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isVisible()),
  );

/** «پیشنهاد تعریف آنالیز استاندارد را رد می کند», and every registration not about the offer. */
export const DeclineTheStandardBomOffer = (): Task =>
  Task.where(
    '#actor declines the offer to define a standard BOM',
    WaitUntil(ProductsPage.declineStandardBomOfferButton(), isVisible()),
    Click.on(ProductsPage.declineStandardBomOfferButton()),
    WaitUntil(ProductsPage.acceptStandardBomOfferButton(), isGone()),
  );

/** «فرم ثبت آنالیز استاندارد برای محصول «…» باز شود» — the registration form, showing that
 * product. */
export const EnsureTheStandardBomFormIsOpenFor = (productName: string): Task =>
  Task.where(
    d`#actor ensures the new standard BOM form is open for product "${productName}"`,
    WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isVisible()),
    WaitUntil(StandardBomsPage.lockedProduct(), isVisible()),
    Ensure.that(
      Question.about('the product the standard BOM form shows', async (actor) =>
        asRead(await actor.answer(Text.of(StandardBomsPage.lockedProduct()))),
      ),
      equals(`محصول: ${productName}`),
    ),
  );

/**
 * «محصول آن فرم قابل تغییر نباشد» — the product is shown as text and the form offers no product
 * picker (the «محصول» combobox the standard BOMs page's own registration form has).
 */
export const EnsureTheProductOfTheStandardBomFormIsLocked = (): Task =>
  Task.where(
    '#actor ensures the product of the standard BOM form is locked',
    WaitUntil(StandardBomsPage.lockedProduct(), isVisible()),
    Ensure.that(StandardBomsPage.productSelect(), not(isPresent())),
  );

/**
 * «آنالیز استاندارد «…» را در آن فرم ثبت می کند» — fills the open, product-locked form (the MI code
 * the step names; a fresh brand and standard length, «فعال», a weight for every cloned material —
 * the Gherkin names none of them) and submits it, waiting for the answer.
 */
export const RegisterStandardBomInTheOfferedForm = (
  miCode: string,
  productName: string,
): Task =>
  Task.where(
    d`#actor registers standard BOM "${miCode}" for "${productName}" in the offered form`,
    Enter.theValue(miCode).into(StandardBomsPage.miCodeField()),
    Enter.theValue(freshBrand()).into(StandardBomsPage.brandField()),
    Enter.theValue(freshStandardLength()).into(
      StandardBomsPage.standardLengthField(),
    ),
    SelectOption(StandardBomsPage.activeToggle(), 'فعال'),
    FillInTheStandardWeightsOfProductNamed(productName),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
    // Saved, not refused: a refusal keeps the form open with its error or alert.
    WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isGone()),
  );

/** «بدون ذخیره از فرم ثبت آنالیز استاندارد انصراف می دهد» — «انصراف», then the form is gone. */
export const CancelTheStandardBomForm = (): Task =>
  Task.where(
    '#actor cancels the standard BOM form without saving',
    WaitUntil(StandardBomsPage.cancelButton(), isVisible()),
    Click.on(StandardBomsPage.cancelButton()),
    WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isGone()),
  );

/**
 * «تعریف آنالیز استاندارد به او پیشنهاد نشود» — follows a form that has already been answered (a
 * refused registration, a saved edit), yet the offer would open only once the product dialog has
 * finished closing; so this lets that moment pass before checking the offer is absent.
 */
export const EnsureNoStandardBomIsOffered = (): Task =>
  Task.where(
    '#actor ensures no standard BOM is offered',
    Wait.for(NO_OFFER_WATCH),
    Ensure.that(ProductsPage.acceptStandardBomOfferButton(), not(isPresent())),
  );

/**
 * «آنالیز استاندارد «…» در سیستم ثبت شده باشد و به محصول «…» تعلق داشته باشد» — `GET standard-boms` holds a
 * standard BOM with that MI code (digits compared as Latin) on that product.
 */
export const EnsureStandardBomIsRegisteredFor = (
  miCode: string,
  productName: string,
): Task =>
  Task.where(
    d`#actor ensures standard BOM "${miCode}" is registered for product "${productName}"`,
    ViewProductList(),
    taskDependingOn(
      `#actor checks the standard BOMs of product "${productName}"`,
      Question.about(d`the id of product "${productName}"`, async (actor) => {
        const product = (await actor.answer(TheProductList())).find(
          (candidate) => candidate.name === productName,
        );
        if (!product) {
          throw new Error(`No product named "${productName}" is registered.`);
        }
        return product.id;
      }),
      (productId) => [
        ViewStandardBomList(),
        Ensure.that(
          TheStandardBomList(),
          containAtLeastOneItemThat(
            and(
              property('productId', equals(productId)),
              property('miCode', equals(withLatinDigits(miCode))),
            ),
          ),
        ),
      ],
    ),
  );

/**
 * «محصول «…» بدون تغییر در سیستم ثبت شده باشد» — exactly one product of that name, composed exactly
 * as it was registered: the same components, in the same order, each with the same materials.
 */
export const EnsureProductIsStoredAsRegistered = (
  details: NewProductDetails,
): Task =>
  Task.where(
    d`#actor ensures product "${details.name}" is stored as it was registered`,
    ViewProductList(),
    Ensure.that(
      Question.about(
        d`the compositions of products named "${details.name}"`,
        async (actor) =>
          (await actor.answer(TheProductList()))
            .filter((product) => product.name === details.name)
            .map((product) =>
              product.components.map((component) => ({
                name: component.name,
                materials: component.materials.map((material) => material.name),
              })),
            ),
      ),
      equals([
        details.components.map((component) => ({
          name: component.name,
          materials: component.materials.map((material) => material.name),
        })),
      ]),
    ),
  );
