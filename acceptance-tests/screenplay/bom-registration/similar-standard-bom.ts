import {
  AnswersQuestions,
  d,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { LastResponse } from '@serenity-js/rest';
import { Click, Enter, isVisible, Text, Value } from '@serenity-js/web';
import { WaitUntil } from '../common/polling';
import { isGone } from '../common/is-gone';
import { ChooseRowAction } from '../common/row-actions';
import { readAsTheSystemAdmin } from '../common/observer';
import { taskDependingOn } from '../common/task-depending-on';
import { withLatinDigits } from '../common/persian-digits';
import { StandardBomsPage } from '../ui/standard-boms-page';
import {
  LocateStandardBomsPage,
  WaitForTheStandardBomFormToBeAnswered,
} from './standard-bom-form';
import { RegisterStandardBomAndRememberIt } from './register-standard-bom';
import { RegisterProductUnlessRegistered } from './register-product';
import {
  freshProductDetails,
  theProductRegisteredWithName,
} from './product-details';
import { ProductSummary } from './view-product-list';
import {
  StandardBomSummary,
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';

/**
 * Issue #133 — «تعریف آنالیز مشابه»: a new, independent standard BOM registered from an existing
 * one. A `/standard-boms` row's menu item opens the ordinary new standard BOM form (`POST
 * standard-boms` on save) filled from the source — product (still selectable), MI code, brand,
 * standard length, active flag, description and every standard weight. Keeping the MI code is
 * refused like any duplicate (409 `standard-bom-mi-code-taken`, shown as the form's MI code error).
 *
 * Every action here is the browser's; the source is noted over the API beforehand (by the step, as
 * یاشار — `record-dependencies.ts#NoteTheStandardBom`), and the facts are read over the API.
 */

export interface StandardBomInformation {
  brand: string;
  standardLength: string;
  description: string;
}

// ---------------------------------------------------------------------------------------------
// The precondition

/**
 * «اینکه آنالیز استاندارد «…» با برند «…»، متراژ استاندارد «…» و توضیحات «…» برای محصول «…» ثبت
 * شده باشد» — the product unless registered (the Background registers it, with a fresh
 * composition), then the standard BOM cloning it with those values, «فعال», and a fresh weight per
 * material.
 */
export const RegisterStandardBomWithInformationForProduct = (
  miCode: string,
  productName: string,
  information: StandardBomInformation,
): Task =>
  Task.where(
    d`#actor registers standard BOM "${miCode}" for product "${productName}" with ${information}`,
    RegisterProductUnlessRegistered(freshProductDetails({ name: productName })),
    taskDependingOn(
      `#actor registers standard BOM "${miCode}" for "${productName}"`,
      Question.about(`product "${productName}"`, () =>
        theProductRegisteredWithName(productName),
      ),
      (product) => [
        RegisterStandardBomAndRememberIt(product, {
          miCode,
          brand: information.brand,
          standardLength: information.standardLength,
          description: information.description,
          active: true,
        }),
        Ensure.that(LastResponse.status(), equals(201)),
      ],
    ),
  );

// ---------------------------------------------------------------------------------------------
// The form

/** «… تعریف آنالیز مشابه «…» را انتخاب می کند» — the source row's menu item, then the new
 * standard BOM form it opens (waited for by its heading). */
export const OpenTheSimilarStandardBomFormOf = (sourceMiCode: string): Task =>
  Task.where(
    d`#actor opens the similar standard BOM form of "${sourceMiCode}"`,
    LocateStandardBomsPage(),
    ChooseRowAction(sourceMiCode, 'create-similar-standard-bom'),
    WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isVisible()),
  );

/** The same, and then waits until the form holds the source's MI code, so what the actor types next
 * is not overwritten by the form filling itself in. */
const OpenTheFilledSimilarStandardBomFormOf = (sourceMiCode: string): Task =>
  Task.where(
    d`#actor opens the similar standard BOM form of "${sourceMiCode}", filled in`,
    OpenTheSimilarStandardBomFormOf(sourceMiCode),
    WaitUntil(Value.of(StandardBomsPage.miCodeField()), equals(sourceMiCode)),
  );

/** What a standard BOM form shows, field by field. Lengths and weights as numbers, so «305» and
 * «305.0» are one value. */
interface StandardBomFormValues {
  product: string;
  miCode: string;
  brand: string;
  standardLength: number;
  active: string;
  description: string;
  weights: Array<{ material: string; weight: number }>;
}

const ACTIVE_LABEL = { true: 'فعال', false: 'غیرفعال' } as const;

/** The values the source standard BOM should fill the form with, read over the API as یاشار. */
const TheValuesOfStandardBom = (
  miCode: string,
): QuestionAdapter<StandardBomFormValues> =>
  Question.about(d`the form values of standard BOM "${miCode}"`, async () => {
    const source = theStandardBomWithMiCode(
      await readAsTheSystemAdmin<StandardBomSummary[]>('standard-boms'),
      miCode,
    );
    const product = (
      await readAsTheSystemAdmin<ProductSummary[]>('products')
    ).find((candidate) => candidate.id === source.productId);
    return {
      product: product?.name ?? `(product ${source.productId})`,
      miCode: source.miCode,
      brand: source.brand,
      standardLength: source.standardLength,
      active: ACTIVE_LABEL[`${source.active}`],
      description: source.description ?? '',
      weights: source.components.flatMap((component) =>
        component.materials.map((material) => ({
          material: material.name,
          weight: material.weight,
        })),
      ),
    };
  });

/** What the open standard BOM form shows — a weight for each of `materials`, reached by name. */
const theValuesOfTheOpenStandardBomForm = async (
  actor: AnswersQuestions,
  materials: string[],
): Promise<StandardBomFormValues> => {
  const weights: StandardBomFormValues['weights'] = [];
  for (const material of materials) {
    weights.push({
      material,
      weight: Number(
        await actor.answer(Value.of(StandardBomsPage.weightField(material))),
      ),
    });
  }
  return {
    product: await actor.answer(Value.of(StandardBomsPage.productSelect())),
    miCode: await actor.answer(Value.of(StandardBomsPage.miCodeField())),
    brand: await actor.answer(Value.of(StandardBomsPage.brandField())),
    standardLength: Number(
      await actor.answer(Value.of(StandardBomsPage.standardLengthField())),
    ),
    active: (
      await actor.answer(Text.of(StandardBomsPage.activeToggle()))
    ).trim(),
    description: await actor.answer(
      Value.of(StandardBomsPage.descriptionField()),
    ),
    weights,
  };
};

/**
 * «فرم ثبت آنالیز استاندارد جدید با اطلاعات آنالیز استاندارد «…» باز شود» — the registration form
 * (not the edit one), its product picker still there and showing the source's product, and every
 * other field — MI code, brand, standard length, active flag, description, each material's standard
 * weight — holding the source's value.
 */
export const EnsureTheNewStandardBomFormShowsStandardBom = (
  sourceMiCode: string,
): Task =>
  taskDependingOn(
    `#actor ensures the new standard BOM form shows standard BOM "${sourceMiCode}"`,
    TheValuesOfStandardBom(sourceMiCode),
    (expected) => {
      const shown = Question.about(
        'what the open standard BOM form shows',
        (actor) =>
          theValuesOfTheOpenStandardBomForm(
            actor,
            expected.weights.map((line) => line.material),
          ),
      );
      return [
        WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isVisible()),
        WaitUntil(shown, equals(expected)),
        Ensure.that(shown, equals(expected)),
      ];
    },
  );

/** «… آنالیز مشابه «…» را با کد MI «…» (و برند «…») ثبت می کند» — the filled form, the MI code (and
 * brand) changed, saved; a saved form closes. */
export const RegisterSimilarStandardBom = (
  sourceMiCode: string,
  changes: { miCode: string; brand?: string },
): Task =>
  Task.where(
    d`#actor registers a standard BOM similar to "${sourceMiCode}" with ${changes}`,
    OpenTheFilledSimilarStandardBomFormOf(sourceMiCode),
    Enter.theValue(changes.miCode).into(StandardBomsPage.miCodeField()),
    ...(changes.brand === undefined
      ? []
      : [Enter.theValue(changes.brand).into(StandardBomsPage.brandField())]),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
    // Saved, not refused: a refusal keeps the form open with its error or alert.
    WaitUntil(StandardBomsPage.newStandardBomFormHeading(), isGone()),
  );

/** «… تلاش می کند آنالیز مشابه «…» را بدون تغییر کد MI ثبت کند» — the filled form saved as it is,
 * waiting for the answer (expected: the duplicate MI code error). */
export const AttemptToRegisterSimilarStandardBomKeepingItsMiCode = (
  sourceMiCode: string,
): Task =>
  Task.where(
    d`#actor attempts to register a standard BOM similar to "${sourceMiCode}" keeping its MI code`,
    OpenTheFilledSimilarStandardBomFormOf(sourceMiCode),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
  );

// ---------------------------------------------------------------------------------------------
// Facts

/** A standard BOM as «همان اطلاعات» means it: everything but its id and MI code — components by
 * name, each material by name with its standard weight. */
const theInformationOf = (standardBom: StandardBomSummary) => ({
  productId: standardBom.productId,
  brand: standardBom.brand,
  standardLength: standardBom.standardLength,
  active: standardBom.active,
  description: standardBom.description ?? null,
  components: standardBom.components.map((component) => ({
    name: component.name,
    materials: component.materials.map((material) => ({
      name: material.name,
      weight: material.weight,
    })),
  })),
});

const theStandardBomWithMiCode = (
  standardBoms: StandardBomSummary[],
  miCode: string,
): StandardBomSummary => {
  const found = standardBoms.find(
    (candidate) =>
      withLatinDigits(candidate.miCode) === withLatinDigits(miCode),
  );
  if (!found) {
    throw new Error(`No standard BOM with MI code "${miCode}" is registered.`);
  }
  return found;
};

/**
 * «آنالیز استاندارد «…» با همان اطلاعات آنالیز استاندارد «…» در سیستم ثبت شده باشد» and «برند
 * آنالیز استاندارد «…» «…» باشد و بقیه اطلاعات آن با آنالیز استاندارد «…» یکسان باشد» — the new
 * standard BOM is registered and carries the source's product, brand (unless `except.brand`),
 * standard length, active flag, description and components, materials and weights.
 */
export const EnsureStandardBomCarriesTheInformationOf = (
  miCode: string,
  sourceMiCode: string,
  except: { brand?: string } = {},
): Task =>
  Task.where(
    d`#actor ensures standard BOM "${miCode}" carries the information of "${sourceMiCode}" except ${except}`,
    ViewStandardBomList(),
    Ensure.that(
      Question.about(
        d`the information of standard BOM "${miCode}"`,
        async (actor) =>
          theInformationOf(
            theStandardBomWithMiCode(
              await actor.answer(TheStandardBomList()),
              miCode,
            ),
          ),
      ),
      equals(
        Question.about(
          d`the information of standard BOM "${sourceMiCode}", brand ${except.brand ?? 'kept'}`,
          async (actor) => ({
            ...theInformationOf(
              theStandardBomWithMiCode(
                await actor.answer(TheStandardBomList()),
                sourceMiCode,
              ),
            ),
            ...(except.brand === undefined ? {} : { brand: except.brand }),
          }),
        ),
      ),
    ),
  );
