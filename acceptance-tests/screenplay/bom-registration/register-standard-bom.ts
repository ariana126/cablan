import {
  AnswersQuestions,
  Check,
  d,
  Interaction,
  Question,
  QuestionAdapter,
  Task,
  Wait,
} from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  isLessThan,
  property,
} from '@serenity-js/assertions';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import {
  OpenNewStandardBomForm,
  SearchAndSelectProduct,
  SelectOption,
  WaitForTheStandardBomFormToBeAnswered,
} from './standard-bom-form';
import {
  NewComponentInStandardBom,
  NewStandardBomDetails,
  freshStandardBomDetailsFor,
  freshWeightInGrams,
  rememberAttempt,
  rememberRegisteredStandardBom,
  theAttempt,
} from './standard-bom-details';
import { ProductSummary } from './view-product-list';
import {
  freshMaterialInComponent,
  freshProductDetails,
  theLastRegisteredProduct,
} from './product-details';
import { RegisterProductAndRememberIt } from './register-product';
import { SequentiallyDependentTask } from '../common/sequentially-dependent-task';
import { withLatinDigits } from '../common/persian-digits';
import {
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';

export const registerRequestBody = (details: NewStandardBomDetails) => ({
  productId: details.productId,
  miCode: details.miCode,
  brand: details.brand,
  standardLength: Number(details.standardLength),
  active: details.active,
  ...(details.description !== undefined
    ? { description: details.description }
    : {}),
  components: details.components.map((component) => ({
    componentId: component.componentId,
    materials: component.materials.map((material) => ({
      materialId: material.materialId,
      weight: material.weightInGrams,
    })),
  })),
});

/**
 * Reads the given product's CURRENT composition off an already-fetched `GET /products` response
 * (`LastResponse`) and turns it into a fresh, cloned composition (with real master component/
 * material ids, each material given a fresh weight) — the API-door equivalent of what the real
 * "new standard BOM" form is assumed to do automatically once a product is chosen
 * (`standard-bom-form.ts`'s own comment on `OpenNewStandardBomForm`). Assumes a `Send.a(GetRequest.
 * to('products'))` was already performed by the same actor immediately before this runs.
 */
const cloneProductComposition = async (
  actor: AnswersQuestions,
  productId: string,
  productName: string,
): Promise<NewComponentInStandardBom[]> => {
  const products = await actor.answer(LastResponse.body<ProductSummary[]>());
  const found = products.find((product) => product.id === productId);
  if (!found) {
    throw new Error(
      `Product "${productName}" (${productId}) was not found while cloning its composition into ` +
        'a new standard BOM.',
    );
  }
  return found.components.map((component) => ({
    componentId: component.id,
    componentName: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      materialName: material.name,
      weightInGrams: freshWeightInGrams(),
    })),
  }));
};

/**
 * Fills in a fresh standard weight for every material the open standard BOM form has cloned from
 * `product` — right after the product has been selected. Unlike the API-driven
 * `cloneProductComposition` above, the UI path never learns real component/material ids from the
 * form itself (there is no `componentSelect`/`materialSelect` — see `standard-boms-page.ts`'s own
 * comment), so this re-fetches `product`'s current composition the same way that function does,
 * purely to learn each material's *name* — the one thing `StandardBomsPage.weightField(materialName)`
 * needs to reach its field, since the real markup carries no other stable per-material identity.
 */
const FillInClonedMaterialWeights = (product: {
  id: string;
  name: string;
}): Interaction =>
  Interaction.where(
    '#actor fills in a standard weight for each cloned material',
    async (actor) => {
      await Send.a(GetRequest.to('products')).performAs(actor);
      const products = await actor.answer(
        LastResponse.body<ProductSummary[]>(),
      );
      const found = products.find((p) => p.id === product.id);
      if (!found) {
        throw new Error(
          `Product "${product.name}" (${product.id}) was not found while filling in its cloned ` +
            'material weights.',
        );
      }
      for (const component of found.components) {
        for (const material of component.materials) {
          const weightField = await actor.answer(
            StandardBomsPage.weightField(material.name),
          );
          await weightField.enterValue(`${freshWeightInGrams()}`);
        }
      }
    },
  );

export const RegisterStandardBom = {
  /**
   * Registers a standard BOM through the real "new standard BOM" form — the UI door this feature's
   * top-level "ثبت می کند" scenario, and every "قانون" example driven by مصطفی, drive (per the
   * dispatch this automation was written against). Selecting `product.name` is assumed to make the
   * form clone that product's current composition automatically, leaving only a weight to fill in
   * per material (`FillInClonedMaterialWeights`) — see `standard-bom-details.ts`'s own comment on
   * why a Standard BOM's composition references rather than freely creates master data.
   */
  using: (
    product: { id: string; name: string },
    details: Pick<
      NewStandardBomDetails,
      'miCode' | 'brand' | 'standardLength' | 'active' | 'description'
    >,
  ): Task =>
    Task.where(
      d`#actor registers a new standard BOM for product "${product.name}"`,
      OpenNewStandardBomForm(),
      SearchAndSelectProduct(StandardBomsPage.productSelect(), product.name),
      Enter.theValue(details.miCode).into(StandardBomsPage.miCodeField()),
      Enter.theValue(details.brand).into(StandardBomsPage.brandField()),
      Enter.theValue(details.standardLength).into(
        StandardBomsPage.standardLengthField(),
      ),
      // "قانون: وضعیت فعال بودن ... باید ... مشخص شود" — the combobox is left untouched (no
      // default) whenever `active` is `undefined`, which is exactly what that rule's negative
      // example needs.
      ...(details.active === true
        ? [SelectOption(StandardBomsPage.activeToggle(), 'فعال')]
        : []),
      ...(details.description !== undefined
        ? [
            Enter.theValue(details.description).into(
              StandardBomsPage.descriptionField(),
            ),
          ]
        : []),
      FillInClonedMaterialWeights(product),
      Click.on(StandardBomsPage.submitButton()),
      WaitForTheStandardBomFormToBeAnswered(),
    ),

  /** The API door — used for background test-data setup and the access-denied "تلاش می کند" rule. */
  viaApiUsing: (details: NewStandardBomDetails): Task =>
    Task.where(
      d`#actor registers a new standard BOM with MI code "${details.miCode}" (via API)`,
      Send.a(
        PostRequest.to('standard-boms').with(registerRequestBody(details)),
      ),
    ),
};

/**
 * Registers a standard BOM via the API — cloning `product`'s current composition, fetched fresh —
 * and remembers it as "the last registered standard BOM"/"the standard BOM with MI code X"
 * (`standard-bom-details.ts`), for scenarios that go on to edit or delete it, possibly as a
 * *different* actor than the one performing this task. Used for `Given` (passive-voiced)
 * preconditions only; the feature's active-voiced scenarios drive the UI instead
 * (`RegisterStandardBom.using`).
 */
export const RegisterStandardBomAndRememberIt = (
  product: { id: string; name: string },
  overrides: Partial<
    Omit<NewStandardBomDetails, 'productId' | 'productName' | 'components'>
  > = {},
  /** Restricts which of the product's cloned components/materials end up on this standard BOM —
   * left unset (full clone) by every bom-registration call site, given explicitly by
   * bom-reporting's own fixture setup, whose background groups can share one product yet each need
   * only their own subset of it as a standard BOM
   * (`screenplay/bom-reporting/bom-report-fixtures.ts`). Mirrors `register-bom.ts`'s own
   * `weightForMaterial` parameter, one tier up the clone chain. */
  selectComposition: (
    composition: NewComponentInStandardBom[],
  ) => NewComponentInStandardBom[] = (composition) => composition,
): Task => {
  let details!: NewStandardBomDetails;
  return Task.where(
    d`#actor registers a new standard BOM for product "${product.name}" (via API) and remembers it`,
    Send.a(GetRequest.to('products')),
    Interaction.where(
      '#actor clones the product composition into fresh standard BOM details',
      async (actor) => {
        const composition = await cloneProductComposition(
          actor,
          product.id,
          product.name,
        );
        details = freshStandardBomDetailsFor(
          product,
          selectComposition(composition),
          overrides,
        );
      },
    ),
    Interaction.where(
      '#actor submits the drafted standard BOM',
      async (actor) => {
        await Send.a(
          PostRequest.to('standard-boms').with(registerRequestBody(details)),
        ).performAs(actor);
      },
    ),
    Interaction.where(
      '#actor remembers the registered standard BOM',
      async (actor) => {
        const body = await actor.answer(LastResponse.body<{ id: string }>());
        rememberRegisteredStandardBom({
          id: body.id,
          miCode: details.miCode,
          productId: product.id,
          productName: product.name,
        });
        rememberAttempt<NewStandardBomDetails>(details);
      },
    ),
  );
};

/**
 * The access-denied "تلاش می کند" rule's own attempt: drafts a fresh standard BOM cloning
 * `product`'s composition and attempts to register it via the API, without remembering it as
 * registered (it never will be — `RolesGuard` rejects it before it reaches the domain). Mirrors
 * `screenplay/bom-registration/register-product.ts#RegisterProduct.viaApiUsing`'s role in the same
 * rule, extended with the fetch-and-clone step this feature's own composition needs.
 */
export const AttemptToRegisterStandardBomForProductViaApi = (product: {
  id: string;
  name: string;
}): Task => {
  let details!: NewStandardBomDetails;
  return Task.where(
    d`#actor attempts to register a new standard BOM for product "${product.name}" (via API)`,
    Send.a(GetRequest.to('products')),
    Interaction.where(
      '#actor clones the product composition into fresh standard BOM details',
      async (actor) => {
        const composition = await cloneProductComposition(
          actor,
          product.id,
          product.name,
        );
        details = freshStandardBomDetailsFor(product, composition);
        rememberAttempt<NewStandardBomDetails>(details);
      },
    ),
    Interaction.where(
      '#actor submits the drafted standard BOM',
      async (actor) => {
        await Send.a(
          PostRequest.to('standard-boms').with(registerRequestBody(details)),
        ).performAs(actor);
      },
    ),
  );
};

/**
 * «اینکه آنالیز استانداردی با کد MI «…» در سیستم ثبت شده باشد», idempotent within a scenario: a
 * fresh product and a standard BOM with `miCode` cloning it — unless the system already holds a
 * standard BOM with that MI code, in which case that one is remembered and nothing is registered.
 * The Persian-digit examples of `registring-bom.feature` repeat the background line, and a second
 * registration would be refused as a duplicate MI code.
 *
 * Checked against the system rather than against this suite's own registry, which is not reset
 * between scenarios: the database is (`support/hooks.ts`), so whatever `GET standard-boms` reports
 * was registered in this scenario.
 */
export const RegisterStandardBomWithMiCodeUnlessRegistered = (
  miCode: string,
): Task =>
  Task.where(
    d`#actor makes sure a standard BOM with MI code "${miCode}" is registered`,
    ViewStandardBomList(),
    Check.whether(CountOfStandardBomsWithMiCode(miCode), isGreaterThan(0))
      .andIfSo(RememberTheRegisteredStandardBomWithMiCode(miCode))
      .otherwise(
        new SequentiallyDependentTask(
          d`#actor registers a fresh product and standard BOM "${miCode}" for it (via API)`,
          RegisterProductAndRememberIt(freshProductDetails()),
          () =>
            RegisterStandardBomAndRememberIt(theLastRegisteredProduct(), {
              miCode,
            }),
        ),
      ),
  );

/** Remembers the standard BOM with `miCode` that the last `ViewStandardBomList()` reported, along
 * with its product's name (one more `GET products`). */
const RememberTheRegisteredStandardBomWithMiCode = (
  miCode: string,
): Interaction =>
  Interaction.where(
    d`#actor remembers the already registered standard BOM "${miCode}"`,
    async (actor) => {
      const standardBom = (await actor.answer(TheStandardBomList())).find(
        (candidate) => sameMiCode(candidate.miCode, miCode),
      )!;
      await Send.a(GetRequest.to('products')).performAs(actor);
      const product = (
        await actor.answer(LastResponse.body<ProductSummary[]>())
      ).find((candidate) => candidate.id === standardBom.productId);
      rememberRegisteredStandardBom({
        id: standardBom.id,
        miCode,
        productId: standardBom.productId,
        productName: product?.name ?? '',
      });
    },
  );

/**
 * «آنالیز استاندارد جدیدی با کد MI «…» ثبت شده باشد» — reads the standard BOMs back from
 * `GET standard-boms` and looks for the one just registered (by the brand the attempt drafted, fresh
 * per attempt) stored under `miCode`: the MI code the system should have kept, which is the
 * Latin-digit form even when the visitor typed Persian digits.
 */
export const EnsureStandardBomWasStoredWithMiCode = (
  attempt: Pick<NewStandardBomDetails, 'brand'>,
  miCode: string,
): Task =>
  Task.where(
    d`#actor ensures the new standard BOM was stored with MI code "${miCode}"`,
    ViewStandardBomList(),
    Ensure.that(
      TheStandardBomList(),
      containAtLeastOneItemThat(
        and(
          property('brand', equals(attempt.brand)),
          property('miCode', equals(miCode)),
        ),
      ),
    ),
  );

/** Through the UI, assert what the visitor sees: the new standard BOM's MI code in the rendered list. */
export const EnsureStandardBomWasRegistered = (miCode: string): Task =>
  Task.where(
    d`#actor ensures standard BOM "${miCode}" was registered`,
    Wait.until(StandardBomsPage.standardBomNamed(miCode), isVisible()),
  );

/** «۱۲۳۴» and «1234» are one MI code (issue #62), so they are counted as one — otherwise a
 * Persian-digit duplicate the system wrongly let through would pass for a different code. */
const sameMiCode = (a: string, b: string): boolean =>
  withLatinDigits(a) === withLatinDigits(b);

const CountOfStandardBomsWithMiCode = (
  miCode: string,
): QuestionAdapter<number> =>
  Question.about(
    `the count of standard BOMs with MI code "${miCode}"`,
    async (actor) => {
      const standardBoms = await actor.answer(TheStandardBomList());
      return standardBoms.filter((standardBom) =>
        sameMiCode(standardBom.miCode, miCode),
      ).length;
    },
  );

/**
 * Door-agnostic on purpose, mirroring
 * `screenplay/bom-registration/register-product.ts#EnsureNewProductWasNotRegistered`: this
 * feature's "آنالیز استاندارد جدیدی ثبت نشده باشد" step follows both a UI-driven attempt (missing
 * field, duplicate MI, active not specified) and an API-driven one (access-denied), so rather than
 * reading `LastResponse` — which the UI-driven attempts never populate — this re-queries the system
 * and checks the invariant the uniqueness rule actually protects: never more than one standard BOM
 * sharing the attempted MI code.
 *
 * The re-query is skipped when `LastResponse` already reports an error (> 399): the access-denied
 * rule's API-driven attempt, whose failed response is the proof the re-query would otherwise
 * reconfirm — skipping it also avoids overwriting `LastResponse` with a GET's 200 before the shared
 * "پیغام خطای عدم دسترسی نشان داده شود" step reads the original attempt's 403 off it.
 */
export const EnsureNewStandardBomWasNotRegistered = (): Task => {
  const attempted = theAttempt<NewStandardBomDetails>();
  return Task.where(
    '#actor ensures a new standard BOM was not registered',
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewStandardBomList(),
        Ensure.that(
          CountOfStandardBomsWithMiCode(attempted.miCode),
          isLessThan(2),
        ),
      ),
  );
};

/**
 * Opens the "new standard BOM" form for `product`, selects it (cloning its composition), fills in
 * every field of `details` except `active` (handled the same way `RegisterStandardBom.using` does —
 * touched only when `true`) and every cloned material's weight — without submitting yet. The "اما
 * ... را ... میگذارد" steps that follow overwrite one field and submit.
 */
export const EnterNewStandardBomDetails = (
  product: { id: string; name: string },
  details: Pick<
    NewStandardBomDetails,
    'miCode' | 'brand' | 'standardLength' | 'active' | 'description'
  >,
): Task =>
  Task.where(
    '#actor enters new standard BOM details, without submitting yet',
    OpenNewStandardBomForm(),
    SearchAndSelectProduct(StandardBomsPage.productSelect(), product.name),
    Enter.theValue(details.miCode).into(StandardBomsPage.miCodeField()),
    Enter.theValue(details.brand).into(StandardBomsPage.brandField()),
    Enter.theValue(details.standardLength).into(
      StandardBomsPage.standardLengthField(),
    ),
    ...(details.active === true
      ? [SelectOption(StandardBomsPage.activeToggle(), 'فعال')]
      : []),
    ...(details.description !== undefined
      ? [
          Enter.theValue(details.description).into(
            StandardBomsPage.descriptionField(),
          ),
        ]
      : []),
    FillInClonedMaterialWeights(product),
  );

const SubmitAlreadyOpenStandardBomForm = (): Task =>
  Task.where(
    '#actor submits the already-open standard BOM form',
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
  );

/**
 * The four "اما کد MI/برند/متراژ استاندارد ..." attempts below each break exactly one OTHER field
 * on a form whose `active` combobox was deliberately left untouched by the shared "وارد میکند" step
 * (`step-definitions/bom-registration/registring-standard-bom.steps.ts`'s own comment) — so unlike
 * `AttemptToRegisterWithoutSpecifyingActive`, each of these has to select it here, right before
 * submitting, or the form would surface *its* validation error instead of the one this rule targets.
 */
const SubmitAlreadyOpenStandardBomFormWithActiveSpecified = (): Task =>
  Task.where(
    '#actor selects "فعال" and submits the already-open standard BOM form',
    SelectOption(StandardBomsPage.activeToggle(), 'فعال'),
    SubmitAlreadyOpenStandardBomForm(),
  );

/** The "اما کد MI را {string} وارد میکند" step: overwrites the MI code field and submits. */
export const AttemptToRegisterWithMiCode = (miCode: string): Task =>
  Task.where(
    d`#actor attempts to register the standard BOM with MI code "${miCode}"`,
    Enter.theValue(miCode).into(StandardBomsPage.miCodeField()),
    SubmitAlreadyOpenStandardBomFormWithActiveSpecified(),
  );

/** The "اما کد MI را خالی میگذارد" step. */
export const AttemptToRegisterLeavingMiCodeEmpty = (): Task =>
  Task.where(
    '#actor attempts to register the standard BOM leaving the MI code empty',
    Enter.theValue('').into(StandardBomsPage.miCodeField()),
    SubmitAlreadyOpenStandardBomFormWithActiveSpecified(),
  );

/** The "اما برند را خالی میگذارد" step. */
export const AttemptToRegisterLeavingBrandEmpty = (): Task =>
  Task.where(
    '#actor attempts to register the standard BOM leaving the brand empty',
    Enter.theValue('').into(StandardBomsPage.brandField()),
    SubmitAlreadyOpenStandardBomFormWithActiveSpecified(),
  );

/** The "اما متراژ استاندارد را خالی میگذارد" step. */
export const AttemptToRegisterLeavingStandardLengthEmpty = (): Task =>
  Task.where(
    '#actor attempts to register the standard BOM leaving the standard length empty',
    Enter.theValue('').into(StandardBomsPage.standardLengthField()),
    SubmitAlreadyOpenStandardBomFormWithActiveSpecified(),
  );

/** The "اما وضعیت فعال بودن را مشخص نمی کند" step: submits without ever touching the toggle. */
export const AttemptToRegisterWithoutSpecifyingActive = (): Task =>
  SubmitAlreadyOpenStandardBomForm();

/** One line of a standard BOM with the standard weight of its material — a row of
 * «آنالیز استاندارد زیر با وزن استاندارد مواد اولیه اش ...». */
export interface StandardWeightLine {
  componentName: string;
  materialName: string;
  standardWeightInGrams: number;
}

/**
 * «اینکه آنالیز استاندارد زیر با وزن استاندارد مواد اولیه اش در سیستم ثبت شده باشد:» — a fresh
 * product whose components and materials carry exactly the given names, then a standard BOM with
 * `miCode` cloning it, each material at the given standard weight. Both via the API, remembered as
 * the last registered product and the standard BOM registered with `miCode`. Mirrors the
 * dashboard's score `Given` (`step-definitions/bom-analyzing/bom-dashboard-fixtures.steps.ts`).
 *
 * The standard BOM's registration needs `theLastRegisteredProduct()`, which only exists once the
 * product registration has run — hence `SequentiallyDependentTask`.
 */
export const RegisterStandardBomWithStandardWeights = (
  miCode: string,
  lines: StandardWeightLine[],
  /** A fresh one unless given — exporting-bom's weight totals multiply by it. */
  overrides: Partial<Pick<NewStandardBomDetails, 'standardLength'>> = {},
): Task => {
  const componentNames = [...new Set(lines.map((line) => line.componentName))];
  const standardWeightOf = (
    componentName: string,
    materialName: string,
  ): number => {
    const line = lines.find(
      (l) =>
        l.componentName === componentName && l.materialName === materialName,
    );
    if (!line) {
      throw new Error(
        `No standard weight given for ${componentName} / ${materialName}.`,
      );
    }
    return line.standardWeightInGrams;
  };
  return new SequentiallyDependentTask(
    d`#actor registers standard BOM "${miCode}" with the given standard weights (via API)`,
    RegisterProductAndRememberIt(
      freshProductDetails({
        name: `محصول تست ${miCode}`,
        components: componentNames.map((componentName) => ({
          name: componentName,
          materials: lines
            .filter((line) => line.componentName === componentName)
            .map((line) =>
              freshMaterialInComponent({ name: line.materialName }),
            ),
        })),
      }),
    ),
    () =>
      RegisterStandardBomAndRememberIt(
        theLastRegisteredProduct(),
        { miCode, ...overrides },
        (composition) =>
          composition.map((component) => ({
            ...component,
            materials: component.materials.map((material) => ({
              ...material,
              weightInGrams: standardWeightOf(
                component.componentName,
                material.materialName,
              ),
            })),
          })),
      ),
  );
};
