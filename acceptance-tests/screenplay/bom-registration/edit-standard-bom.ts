import {
  Answerable,
  Check,
  d,
  Interaction,
  PerformsActivities,
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
import {
  GetRequest,
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { StandardBomsPage } from '../ui/standard-boms-page';
import {
  OpenEditStandardBomForm,
  WaitForTheStandardBomFormToBeAnswered,
} from './standard-bom-form';
import {
  NewStandardBomDetails,
  RegisteredStandardBom,
  freshStandardBomDetailsFor,
  freshWeightInGrams,
  rememberAttempt,
  theLastRegisteredStandardBom,
} from './standard-bom-details';
import {
  freshComponentInProduct,
  freshMaterialInComponent,
  freshProductDetails,
  NewComponentInProduct,
  NewMaterialInComponent,
  theLastRegisteredProduct,
} from './product-details';
import { RegisterProductAndRememberIt } from './register-product';
import {
  RegisterStandardBomAndRememberIt,
  registerRequestBody,
} from './register-standard-bom';
import { ProductSummary } from './view-product-list';
import {
  TheStandardBomList,
  ViewStandardBomList,
} from './view-standard-bom-list';

type StandardBomFieldChanges = Partial<
  Pick<
    NewStandardBomDetails,
    'miCode' | 'brand' | 'standardLength' | 'description'
  >
>;

const fieldFor = (field: keyof StandardBomFieldChanges) => {
  switch (field) {
    case 'miCode':
      return StandardBomsPage.miCodeField();
    case 'brand':
      return StandardBomsPage.brandField();
    case 'standardLength':
      return StandardBomsPage.standardLengthField();
    case 'description':
      return StandardBomsPage.descriptionField();
    default:
      throw new Error(`No standard BOM field mapped for "${String(field)}".`);
  }
};

const editRequestBody = (changes: StandardBomFieldChanges) => {
  const body: Record<string, unknown> = {};
  if (changes.miCode !== undefined) body.miCode = changes.miCode;
  if (changes.brand !== undefined) body.brand = changes.brand;
  if (changes.standardLength !== undefined)
    body.standardLength = Number(changes.standardLength);
  if (changes.description !== undefined) body.description = changes.description;
  return body;
};

export const EditStandardBom = {
  /**
   * Edits a standard BOM through the real "edit standard BOM" form — the UI door this feature's
   * top-level "ویرایش می کند" scenario, and every "قانون" example driven by مصطفی, drive. Locates
   * the form by the standard BOM's *current* MI code, since that's what the rendered list still
   * shows until the edit succeeds (unless the edit itself changes the MI code).
   */
  using: (currentMiCode: string, changes: StandardBomFieldChanges): Task =>
    Task.where(
      d`#actor edits the standard BOM "${currentMiCode}"`,
      OpenEditStandardBomForm(currentMiCode),
      ...(Object.keys(changes) as Array<keyof StandardBomFieldChanges>).map(
        (field) => Enter.theValue(changes[field] ?? '').into(fieldFor(field)),
      ),
      Click.on(StandardBomsPage.submitButton()),
      WaitForTheStandardBomFormToBeAnswered(),
    ),

  /** The API door — used for the access-denied "تلاش می کند" rule. */
  viaApiUsing: (id: string, changes: StandardBomFieldChanges): Task =>
    Task.where(
      d`#actor edits standard BOM ${id} (via API)`,
      Send.a(
        PatchRequest.to(`standard-boms/${id}`).with(editRequestBody(changes)),
      ),
    ),
};

/** Through the UI, assert what the visitor sees: the edited MI code in the rendered list. */
export const EnsureStandardBomWasEditedWith = (
  changes: StandardBomFieldChanges,
): Task => {
  if (changes.miCode === undefined) {
    throw new Error(
      'EnsureStandardBomWasEditedWith expects a "miCode" change — the top-level scenario this ' +
        'suite automates edits the MI code.',
    );
  }
  const newMiCode = changes.miCode;
  return Task.where(
    d`#actor ensures the standard BOM was edited to MI code "${newMiCode}"`,
    Wait.until(StandardBomsPage.standardBomNamed(newMiCode), isVisible()),
  );
};

/**
 * Door-agnostic on purpose, mirroring
 * `screenplay/bom-registration/edit-product.ts#EnsureProductWasNotEdited`: this feature's "آنالیز
 * استاندارد ویرایش نشده باشد" step follows an API-driven attempt (access-denied) as well as
 * UI-driven ones (missing/duplicate MI code, missing brand/standard length), so rather than reading
 * `LastResponse` it re-queries the system and checks the one fact that matters regardless of door —
 * the standard BOM `theLastRegisteredStandardBom()` names is still exactly as it was.
 */
export const EnsureStandardBomWasNotEdited = (): Task => {
  const target = theLastRegisteredStandardBom();
  return Task.where(
    d`#actor ensures standard BOM "${target.miCode}" was not edited`,
    Check.whether(LastResponse.status(), isGreaterThan(399))
      .andIfSo()
      .otherwise(
        ViewStandardBomList(),
        Ensure.that(
          TheStandardBomList(),
          containAtLeastOneItemThat(
            and(
              property('id', equals(target.id)),
              property('miCode', equals(target.miCode)),
            ),
          ),
        ),
      ),
  );
};

/** The "{actor} کد MI آن را پاک می کند" step. */
export const AttemptToClearMiCode = (currentMiCode: string): Task =>
  Task.where(
    d`#actor attempts to clear the MI code of "${currentMiCode}"`,
    OpenEditStandardBomForm(currentMiCode),
    Enter.theValue('').into(StandardBomsPage.miCodeField()),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
  );

/** The "{actor} برند آن را پاک می کند" step. */
export const AttemptToClearBrand = (currentMiCode: string): Task =>
  Task.where(
    d`#actor attempts to clear the brand of "${currentMiCode}"`,
    OpenEditStandardBomForm(currentMiCode),
    Enter.theValue('').into(StandardBomsPage.brandField()),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
  );

/** The "{actor} متراژ استاندارد آن را پاک می کند" step. */
export const AttemptToClearStandardLength = (currentMiCode: string): Task =>
  Task.where(
    d`#actor attempts to clear the standard length of "${currentMiCode}"`,
    OpenEditStandardBomForm(currentMiCode),
    Enter.theValue('').into(StandardBomsPage.standardLengthField()),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
  );

/**
 * The "{actor} کد MI آن را به کدی تکراری تغییر می دهد" step. This example's own Given registers
 * only ONE standard BOM, so a second one — for the same product, never remembered as "the last
 * registered standard BOM" — is registered here purely to obtain a real, already-taken MI code to
 * collide with, before attempting (through the UI, per this rule's own door) to change the target's
 * MI code to it.
 */
export const ChangeMiCodeToADuplicate = (): Task => {
  const target: RegisteredStandardBom = theLastRegisteredStandardBom();
  let collidingMiCode = '';
  return Task.where(
    d`#actor changes the MI code of "${target.miCode}" to one that collides with another standard BOM`,
    Send.a(GetRequest.to('products')),
    Interaction.where(
      '#actor registers another standard BOM for the same product to obtain a colliding MI code',
      async (actor) => {
        const products = await actor.answer(
          LastResponse.body<ProductSummary[]>(),
        );
        const product = products.find((p) => p.id === target.productId);
        if (!product) {
          throw new Error(
            `Product "${target.productName}" (${target.productId}) was not found while ` +
              'obtaining a colliding MI code.',
          );
        }
        const composition = product.components.map((component) => ({
          componentId: component.id,
          componentName: component.name,
          materials: component.materials.map((material) => ({
            materialId: material.id,
            materialName: material.name,
            weightInGrams: freshWeightInGrams(),
          })),
        }));
        const collidingDetails = freshStandardBomDetailsFor(
          { id: product.id, name: product.name },
          composition,
        );
        collidingMiCode = collidingDetails.miCode;
        await Send.a(
          PostRequest.to('standard-boms').with(
            registerRequestBody(collidingDetails),
          ),
        ).performAs(actor);
      },
    ),
    OpenEditStandardBomForm(target.miCode),
    Interaction.where('#actor enters the colliding MI code', async (actor) => {
      const miCodeField = await actor.answer(StandardBomsPage.miCodeField());
      await miCodeField.enterValue(collidingMiCode);
    }),
    Click.on(StandardBomsPage.submitButton()),
    WaitForTheStandardBomFormToBeAnswered(),
  );
};

/**
 * Performs `first`, then builds and performs whatever `next()` returns, then runs `after` — the
 * escape hatch `Task.where`'s static activity list can't express: it needs `first` (registering a
 * fresh product) to have *actually run* before `next()` can read the product it just registered
 * (`theLastRegisteredProduct()`). `Task.where(first, next())` can't do this — both arguments are
 * evaluated eagerly, before either one has performed. `after` exists for the same reason in
 * reverse: `RegisterStandardBomAndRememberIt` (typically `next()`) calls `standard-bom-details.ts`'s
 * own `rememberAttempt` internally to remember the standard BOM's own drafted details, so a caller
 * that also wants "the attempt" to mean something else (e.g. the product's fresh components) has to
 * set that *after* `next()` has finished clobbering it, not before it's ever run.
 */
class SequentiallyDependentTask extends Task {
  constructor(
    description: Answerable<string>,
    private readonly first: Task,
    private readonly next: () => Task,
    private readonly after?: () => void,
  ) {
    super(description);
  }

  async performAs(actor: PerformsActivities): Promise<void> {
    await actor.attemptsTo(this.first);
    await actor.attemptsTo(this.next());
    this.after?.();
  }
}

/**
 * The "{actor} چند جز برای آن آنالیز استاندارد ثبت می کند" step. A standard BOM's composition is
 * never freely added to — it is cloned wholesale from its product the instant that product is
 * chosen (`standard-boms-page.ts`'s own class-level note), and the backend rejects any
 * `componentId`/`materialId` that isn't already part of the referenced product's current
 * composition (`StandardBomCompositionFactory`). So "چند جز ... ثبت می کند" can only be satisfied
 * the same way `registring-product.feature`'s own "یک محصول می تواند بیش از یک جز داشته باشد" rule
 * is: by registering a standard BOM for a product that itself has multiple components — reusing
 * `product-details.ts#freshProductDetails`'s own shape for building one, via the API, since this is
 * a `Given`-style fixture feeding a `When` that is really just "look at what's already there". This
 * necessarily registers a *second* standard BOM — the background's own one, for the single-component
 * product, can't grow a component after the fact — and remembers it as "the last registered standard
 * BOM", so the following "تمام اجزای ثبت شده به آنالیز استاندارد مربوط باشند" step checks that one.
 */
export const RegisterStandardBomForProductWithMultipleComponents = (
  count = 2,
): Task => {
  const components: NewComponentInProduct[] = Array.from(
    { length: count },
    () => freshComponentInProduct(),
  );
  const product = freshProductDetails({ components });
  return new SequentiallyDependentTask(
    '#actor registers a standard BOM for a product with multiple components',
    RegisterProductAndRememberIt(product),
    () => RegisterStandardBomAndRememberIt(theLastRegisteredProduct()),
    () => rememberAttempt<NewComponentInProduct[]>(components),
  );
};

/**
 * The standard-BOM branch of the shared "{actor} چند مواد اولیه برای آن جز ثبت می کند" step
 * (`step-definitions/bom-registration/common.steps.ts`) — the one-component-multiple-materials
 * mirror of `RegisterStandardBomForProductWithMultipleComponents` above, satisfiable for exactly the
 * same reason: registers a product whose single component carries multiple materials, then registers
 * a standard BOM for it, which clones that same shape. Remembers the fresh materials as "the
 * attempt" (`standard-bom-details.ts`'s own registry) so the shared step's `Then` half
 * (`EnsureAllRegisteredMaterialsBelongToComponentOfStandardBom`) can check the system against
 * exactly what was tried.
 */
export const RegisterStandardBomForProductWithComponentHavingMultipleMaterials =
  (count = 2): Task => {
    const materials: NewMaterialInComponent[] = Array.from(
      { length: count },
      () => freshMaterialInComponent(),
    );
    const product = freshProductDetails({
      components: [freshComponentInProduct({ materials })],
    });
    return new SequentiallyDependentTask(
      '#actor registers a standard BOM for a product whose component has multiple materials',
      RegisterProductAndRememberIt(product),
      () => RegisterStandardBomAndRememberIt(theLastRegisteredProduct()),
      () => rememberAttempt<NewMaterialInComponent[]>(materials),
    );
  };

const TheComponentNamesOfStandardBom = (
  standardBomId: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the component names of standard BOM ${standardBomId}`,
    async (actor) => {
      const standardBoms = await actor.answer(TheStandardBomList());
      const standardBom = standardBoms.find((s) => s.id === standardBomId);
      return standardBom ? standardBom.components.map((c) => c.name) : [];
    },
  );

/** "انتظار می رود تمام اجزای ثبت شده به آنالیز استاندارد مربوط باشند" */
export const EnsureAllRegisteredComponentsBelongToStandardBom = (
  componentNames: string[],
): Task => {
  const target = theLastRegisteredStandardBom();
  return Task.where(
    '#actor ensures all registered components belong to the standard BOM',
    ViewStandardBomList(),
    ...componentNames.map((name) =>
      Ensure.that(TheComponentNamesOfStandardBom(target.id), contain(name)),
    ),
  );
};

/**
 * The materials of the standard BOM's FIRST component — positionally, which is safe because
 * `RegisterStandardBomForProductWithComponentHavingMultipleMaterials` always builds its product
 * with exactly one component (the one carrying multiple materials).
 */
const TheMaterialNamesOfFirstComponent = (
  standardBomId: string,
): QuestionAdapter<string[]> =>
  Question.about(
    `the material names of the first component of standard BOM ${standardBomId}`,
    async (actor) => {
      const standardBoms = await actor.answer(TheStandardBomList());
      const standardBom = standardBoms.find((s) => s.id === standardBomId);
      const component = standardBom?.components[0];
      return component ? component.materials.map((m) => m.name) : [];
    },
  );

/** "انتظار می رود تمام مواد اولیه ثبت شده به جز مربوط باشند" (standard-BOM branch). */
export const EnsureAllRegisteredMaterialsBelongToComponentOfStandardBom = (
  materialNames: string[],
): Task => {
  const target = theLastRegisteredStandardBom();
  return Task.where(
    '#actor ensures all registered materials belong to the component',
    ViewStandardBomList(),
    ...materialNames.map((name) =>
      Ensure.that(TheMaterialNamesOfFirstComponent(target.id), contain(name)),
    ),
  );
};
