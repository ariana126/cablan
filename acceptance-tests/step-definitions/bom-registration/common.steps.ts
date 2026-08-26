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

// Steps whose text recurs across more than one .feature file within bom-registration/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.

Then('اطلاعات ویرایش شده در سیستم ثبت شده باشد', () => {
  return 'pending';
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

// Backs registring-product.feature's "قانون: یک جز می تواند بیش از یک مواد اولیه داشته باشد" —
// its Given ("اینکه یک جز برای یک محصول در سیستم ثبت شده باشد") lives in
// step-definitions/bom-registration/registring-product.steps.ts, since only that feature's Given
// text maps to it; this When/Then pair's own text doesn't recur anywhere else (yet), but is kept
// here per the dispatch that requested this automation.
When('{actor} چند مواد اولیه برای آن جز ثبت می کند', (actor: Actor) => {
  const product = theLastRegisteredProduct();
  const materials = [freshMaterialInComponent(), freshMaterialInComponent()];
  rememberAttempt<NewMaterialInComponent[]>(materials);
  return actor.attemptsTo(
    RegisterMultipleMaterialsForComponent(product.name, materials),
  );
});

Then('تمام مواد اولیه ثبت شده به جز مربوط باشند', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureAllRegisteredMaterialsBelongToComponent(
      theAttempt<NewMaterialInComponent[]>().map((material) => material.name),
    ),
  ),
);
