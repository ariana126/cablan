import { When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { EnsureNewComponentWasNotRegistered } from '../../screenplay/bom-registration/register-component';
import { EnsureComponentWasNotEdited } from '../../screenplay/bom-registration/edit-component';

// Steps whose text recurs across more than one .feature file within bom-registration/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.

Then('اطلاعات ویرایش شده در سیستم ثبت شده باشد', () => {
  return 'pending';
});

// Shared by registring-component.feature (a standalone component was not registered) and
// registring-product.feature (a component was not registered under a product). Only the former
// is automated so far — registring-product.feature's own preceding steps are still `pending`, so
// its scenarios never reach this Then.
Then('جز جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewComponentWasNotRegistered()),
);

// Shared the same way, between registring-component.feature (a standalone component was not
// edited) and registring-product.feature (a component's materials were not all removed).
Then('جز ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentWasNotEdited()),
);

When('{actor} چند مواد اولیه برای آن جز ثبت می کند', (_actor: Actor) => {
  return 'pending';
});

Then('تمام مواد اولیه ثبت شده به جز مربوط باشند', () => {
  return 'pending';
});
