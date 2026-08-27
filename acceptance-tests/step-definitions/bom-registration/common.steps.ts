import { When, Then } from '@cucumber/cucumber';
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
import {
  NewBomDetails,
  theAttempt as theBomAttempt,
} from '../../screenplay/bom-registration/bom-details';
import { EnsureBomWasEditedWith } from '../../screenplay/bom-registration/edit-bom';

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
      EnsureBomWasEditedWith(theBomAttempt<Partial<NewBomDetails>>()),
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
