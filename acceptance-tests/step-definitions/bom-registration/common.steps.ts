import { When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

// Steps whose text recurs across more than one .feature file within bom-registration/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.

Then('اطلاعات ویرایش شده در سیستم ثبت شده باشد', () => {
  return 'pending';
});

Then('جز جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

Then('جز ویرایش نشده باشد', () => {
  return 'pending';
});

When('{actor} چند مواد اولیه برای آن جز ثبت می کند', (_actor: Actor) => {
  return 'pending';
});

Then('تمام مواد اولیه ثبت شده به جز مربوط باشند', () => {
  return 'pending';
});
