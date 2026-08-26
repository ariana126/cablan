import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LogInAsPersona } from '../screenplay/common/personas';
import { EnsureAccessWasDenied } from '../screenplay/common/problem-detail';
import {
  freshProductDetails,
  theProductRegisteredWithName,
} from '../screenplay/bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../screenplay/bom-registration/register-product';
import {
  NewStandardBomDetails,
  freshBrand,
  freshMiCode,
  freshStandardLength,
  rememberAttempt,
} from '../screenplay/bom-registration/standard-bom-details';
import {
  RegisterStandardBom,
  RegisterStandardBomAndRememberIt,
} from '../screenplay/bom-registration/register-standard-bom';

// Steps whose text is byte-identical across more than one feature area — defined once here
// to avoid an ambiguous match. Two Given definitions exist for the same "actor has logged in"
// precondition because Persian's Given keyword is "با در نظر گرفتن " (note: NOT "...اینکه") —
// "اینکه" ("that") is part of the step TEXT, not the keyword. A standalone Given line therefore
// carries "اینکه" in its matched text, while the same sentence used as an "و" (And) continuation
// of a preceding Given does not, since "و" strips only itself.

/**
 * Logging in as a non-admin persona borrows یاشار's own actor object internally
 * (`screenplay/common/personas.ts`'s `ProvisionPersonaIfNeeded`) to register the account first,
 * which moves Serenity's spotlight to یاشار. Re-affirming it here — after the login itself has
 * completed — is what makes `actorInTheSpotlight()` reliable in every step that follows, since a
 * bare `Then` (no `{actor}`/`{pronoun}` of its own) is exactly how most of this scenario's
 * assertions are written.
 */
const logInAsPersonaAndKeepTheSpotlight = async (
  actor: Actor,
): Promise<void> => {
  await actor.attemptsTo(LogInAsPersona(actor.name));
  actorCalled(actor.name);
};

Given('{actor} وارد سیستم شده باشد', logInAsPersonaAndKeepTheSpotlight);

Then('فهرست خالی نمایش داده شود', () => {
  return 'pending';
});

Given('اینکه {actor} وارد سیستم شده باشد', logInAsPersonaAndKeepTheSpotlight);

Then('پیغام خطای عدم دسترسی نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAccessWasDenied()),
);

// Shared by bom-analyzing and bom-reporting: an anonymous, unauthenticated visitor is
// turned away from a report/dashboard/export and asked to log in.
Then('از او خواسته شود وارد سیستم شود', () => {
  return 'pending';
});

/**
 * The very first line of registring-standard-bom.feature's background, running before either
 * background line that names an actor — so there's nobody in the spotlight yet to act as. یاشار
 * (the one persona the backend seeds on startup — `screenplay/common/personas.ts`) does the
 * registering instead, the same way `personas.ts#ProvisionPersonaIfNeeded` already borrows یاشار's
 * own actor object for test-data setup that has to happen before the scenario's real actor is known.
 */
Given('اینکه محصول {string} در سیستم ثبت شده باشد', (productName: string) =>
  actorCalled('یاشار').attemptsTo(
    LogInAsPersona('یاشار'),
    RegisterProductAndRememberIt(freshProductDetails({ name: productName })),
  ),
);

/**
 * registring-standard-bom.feature's top-level "ثبت آنالیز استاندارد جدید" scenario — the UI door,
 * per the dispatch this automation was written against. Drafts fresh MI code/brand/standard
 * length/active(=true) and drives the real "new standard BOM" form, which is assumed to clone
 * `productName`'s current composition once selected (see
 * `register-standard-bom.ts#RegisterStandardBom.using`'s own comment).
 */
When(
  '{actor} آنالیز استاندارد جدید برای محصول {string} ثبت می کند',
  (actor: Actor, productName: string) => {
    const product = theProductRegisteredWithName(productName);
    const details: NewStandardBomDetails = {
      productId: product.id,
      productName: product.name,
      miCode: freshMiCode(),
      brand: freshBrand(),
      standardLength: freshStandardLength(),
      active: true,
      components: [],
    };
    rememberAttempt<NewStandardBomDetails>(details);
    return actor.attemptsTo(RegisterStandardBom.using(product, details));
  },
);

/**
 * Backs registring-standard-bom.feature's "ویرایش آنالیز استاندارد" scenario as well as its own
 * access-denied edit/delete outlines — all three precede this with a background that's already
 * registered `productName` and logged an actor in, so `actorInTheSpotlight()` is safe here. Kept
 * byte-for-byte distinct from the "در سیستم"-carrying Given of the same shape in
 * `step-definitions/bom-registration/registring-standard-bom.steps.ts`, which backs a different set
 * of examples in the same feature — see that file's own comment.
 */
Given(
  'اینکه یک آنالیز استاندارد برای محصول {string} ثبت شده باشد',
  (productName: string) => {
    const product = theProductRegisteredWithName(productName);
    return actorInTheSpotlight().attemptsTo(
      RegisterStandardBomAndRememberIt(product),
    );
  },
);
