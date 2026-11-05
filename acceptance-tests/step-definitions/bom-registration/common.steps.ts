import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { EnsureNewComponentWasNotRegistered } from '../../screenplay/bom-registration/register-component';
import { EnsureComponentWasNotEdited } from '../../screenplay/bom-registration/edit-component';
import {
  NewMaterialInComponent,
  freshMaterialInComponent,
  rememberAttempt,
  theAttempt,
  theLastRegisteredProduct,
} from '../../screenplay/bom-registration/product-details';
import {
  EnsureAllRegisteredMaterialsBelongToComponent,
  RegisterMultipleMaterialsForComponent,
} from '../../screenplay/bom-registration/edit-product';
import { currentComponentOwner } from '../../screenplay/common/composition-context';
import { currentEditTarget } from '../../screenplay/common/edit-target';
import {
  NewStandardBomDetails,
  theAttempt as theStandardBomAttempt,
} from '../../screenplay/bom-registration/standard-bom-details';
import {
  EnsureAllRegisteredMaterialsBelongToComponentOfStandardBom,
  EnsureStandardBomWasEditedWith,
  RegisterStandardBomForProductWithComponentHavingMultipleMaterials,
} from '../../screenplay/bom-registration/edit-standard-bom';
import { theAttempt as theBomAttempt } from '../../screenplay/bom-registration/bom-details';
import {
  BomFormEdit,
  EnsureBomWasEditedWith,
} from '../../screenplay/bom-registration/edit-bom';
import {
  EnsureNothingUses,
  EnsureProductHasNoStandardBom,
  RegisterProductComposedOf,
  ReplaceMaterialInComponentOfProduct,
} from '../../screenplay/bom-registration/record-dependencies';
import { performAsTheSystemAdmin } from '../../screenplay/common/observer';
import { EnsureToldTheRecordIsUsedIn } from '../../screenplay/common/record-dependents';
import { whatTheMiCodeErrorIsAbout } from '../../screenplay/common/mi-code-error-context';
import { EnsureMiCodeErrorShown } from '../../screenplay/bom-registration/standard-bom-form';
import { EnsureToldAnMiCodeMustBeChosen } from '../../screenplay/bom-registration/daily-bom-order';

// Steps whose text recurs across more than one .feature file within bom-registration/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.

// Shared, byte-for-byte, between registring-standard-bom.feature's "ویرایش آنالیز استاندارد"
// scenario and registring-bom.feature's own "ویرایش آنالیز روزانه" scenario — "اطلاعات ویرایش شده"
// means a changed MI code for one and a changed order number for the other, each with its own
// screenplay module (`edit-standard-bom.ts` vs `edit-bom.ts`), so this dispatches on whichever
// owner's own edit `When` last set `screenplay/common/edit-target.ts`'s `currentEditTarget()` —
// mirrors the `currentComponentOwner()`-style dispatch the "چند مواد اولیه ..." pair below already
// uses.
Then('اطلاعات ویرایش شده در سیستم ثبت شده باشد', () => {
  if (currentEditTarget() === 'bom') {
    return actorInTheSpotlight().attemptsTo(
      EnsureBomWasEditedWith(theBomAttempt<BomFormEdit>()),
    );
  }
  return actorInTheSpotlight().attemptsTo(
    EnsureStandardBomWasEditedWith(
      theStandardBomAttempt<Partial<NewStandardBomDetails>>(),
    ),
  );
});

// Shared by registring-component.feature (a standalone component was not registered) and
// registring-product.feature (a component was not registered under a product, via
// register-product.ts's `EnterNewProductDetails`/product-scoped `RegisterComponentForProduct`
// flows — see registring-product.steps.ts).
Then('جز جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewComponentWasNotRegistered()),
);

// Shared the same way, between registring-component.feature (a standalone component was not
// edited) and registring-product.feature (a component's materials were not all removed).
Then('جز ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentWasNotEdited()),
);

// Shared, byte-identically, between registring-product.feature's "قانون: یک جز می تواند بیش از یک
// مواد اولیه داشته باشد" and registring-standard-bom.feature's own rule of the same name — "آن جز"
// means a component of a *product* in one and a component of a *standard BOM* in the other, each
// with its own screenplay module and form, so this dispatches on whichever owner's own Given last
// ran (`screenplay/common/composition-context.ts`'s own comment has the full reasoning). Each
// Given lives with its owning feature: product's in
// step-definitions/bom-registration/registring-product.steps.ts, standard BOM's in
// step-definitions/bom-registration/registring-standard-bom.steps.ts.
When('{actor} چند مواد اولیه برای آن جز ثبت می کند', (actor: Actor) => {
  if (currentComponentOwner() === 'standard-bom') {
    // Same reasoning as "قانون: یک آنالیز استاندارد می تواند بیش از یک جز داشته باشد"'s own When
    // (registring-standard-bom.steps.ts): the standard BOM the owning Given already registered
    // (for the background's single-material component) can't grow a material after the fact, so
    // this registers a *second* standard BOM — for a fresh product whose one component carries
    // several materials — which becomes "the last registered standard BOM" the Then checks.
    return actor.attemptsTo(
      RegisterStandardBomForProductWithComponentHavingMultipleMaterials(),
    );
  }
  const product = theLastRegisteredProduct();
  const materials = [freshMaterialInComponent(), freshMaterialInComponent()];
  rememberAttempt<NewMaterialInComponent[]>(materials);
  return actor.attemptsTo(
    RegisterMultipleMaterialsForComponent(product.name, materials),
  );
});

Then('تمام مواد اولیه ثبت شده به جز مربوط باشند', () => {
  if (currentComponentOwner() === 'standard-bom') {
    return actorInTheSpotlight().attemptsTo(
      EnsureAllRegisteredMaterialsBelongToComponentOfStandardBom(
        theStandardBomAttempt<NewMaterialInComponent[]>().map(
          (material) => material.name,
        ),
      ),
    );
  }
  return actorInTheSpotlight().attemptsTo(
    EnsureAllRegisteredMaterialsBelongToComponent(
      theAttempt<NewMaterialInComponent[]>().map((material) => material.name),
    ),
  );
});

// Issue #94 — a record other records use can be neither edited nor deleted. These sentences recur,
// byte for byte, across registring-material, registring-component and registring-product; each
// feature's own steps live in its own file. Preconditions and facts are set up and read by the
// system admin over the API (`record-dependencies.ts`).

Given(
  '{string} در هیچ محصول یا آنالیز استانداردی استفاده نشده باشد',
  (name: string) => performAsTheSystemAdmin(EnsureNothingUses(name)),
);

Given(
  'اینکه مواد اولیه {string} فقط در جز {string} محصول {string} استفاده شده باشد',
  (materialName: string, componentName: string, productName: string) =>
    performAsTheSystemAdmin(
      RegisterProductComposedOf(productName, componentName, materialName),
    ),
);

Given(
  'برای محصول {string} هیچ آنالیز استانداردی ثبت نشده باشد',
  (productName: string) =>
    performAsTheSystemAdmin(EnsureProductHasNoStandardBom(productName)),
);

Given(
  'مواد اولیه {string} در جز {string} محصول {string} با {string} جایگزین شده باشد',
  (
    materialName: string,
    componentName: string,
    productName: string,
    replacementName: string,
  ) =>
    performAsTheSystemAdmin(
      ReplaceMaterialInComponentOfProduct(
        materialName,
        replacementName,
        componentName,
        productName,
      ),
    ),
);

// What the refusal told the actor — off the still-open dialog after a browser attempt, from the
// 409 after an API one (`common/refusal-door-context.ts`). The subject's own name is the Gherkin's
// reminder of what was refused; the entry asserted is the kind, its count and one name.

Then(
  'به او گفته شود که {string} در {int} محصول {string} استفاده شده است',
  (_subject: string, count: number, productName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({
        kind: 'product',
        count,
        name: productName,
      }),
    ),
);

Then(
  'به او گفته شود که {string} در {int} آنالیز استاندارد {string} استفاده شده است',
  (_subject: string, count: number, miCode: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureToldTheRecordIsUsedIn({
        kind: 'standard-bom',
        count,
        name: miCode,
      }),
    ),
);

// «پیغام خطای کد MI نشان داده شود» — a standard BOM's MI code left empty or cleared in its form
// (registring-standard-bom), or a daily BOM registered over the API on an order with several MI
// codes and none chosen (registring-bom, issue #101: 400 `bom-mi-code-required`). Dispatched on
// `common/mi-code-error-context.ts`, set by each owning step.
Then('پیغام خطای کد MI نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(
    whatTheMiCodeErrorIsAbout() === 'daily-bom-registration'
      ? EnsureToldAnMiCodeMustBeChosen()
      : EnsureMiCodeErrorShown(),
  ),
);
