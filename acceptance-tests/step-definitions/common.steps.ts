import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

// Steps whose text is byte-identical across more than one feature area — defined once here
// to avoid an ambiguous match. Two Given definitions exist for the same "actor has logged in"
// precondition because Persian's Given keyword is "با در نظر گرفتن " (note: NOT "...اینکه") —
// "اینکه" ("that") is part of the step TEXT, not the keyword. A standalone Given line therefore
// carries "اینکه" in its matched text, while the same sentence used as an "و" (And) continuation
// of a preceding Given does not, since "و" strips only itself.

Given('{actor} وارد سیستم شده باشد', (_actor: Actor) => {
  return 'pending';
});

Then('فهرست خالی نمایش داده شود', () => {
  return 'pending';
});

Given('اینکه {actor} وارد سیستم شده باشد', (_actor: Actor) => {
  return 'pending';
});

Then('پیغام خطای عدم دسترسی نشان داده شود', () => {
  return 'pending';
});

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
