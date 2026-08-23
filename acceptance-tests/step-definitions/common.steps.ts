import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LogInAsPersona } from '../screenplay/common/personas';
import { EnsureAccessWasDenied } from '../screenplay/common/problem-detail';

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

Given('اینکه محصول {string} در سیستم ثبت شده باشد', (_string: string) => {
  return 'pending';
});

When(
  '{actor} آنالیز استاندارد جدید برای محصول {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Given(
  'اینکه یک آنالیز استاندارد برای محصول {string} ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);
