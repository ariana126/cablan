import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When('{actor} جز جدیدی با اطلاعات معتبر ثبت می کند', (_actor: Actor) => {
  return 'pending';
});

Then('جز جدیدی در سیستم ثبت شده باشد', () => {
  return 'pending';
});

Given('اینکه یک جز در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات آن جز را ویرایش می کند', (_actor: Actor) => {
  return 'pending';
});

Then('اطلاعات ویرایش شده جز در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} آن جز را حذف می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن جز از سیستم حذف شده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند جز جدیدی ثبت کند', (_actor: Actor) => {
  return 'pending';
});

When('{actor} تلاش می کند اطلاعات آن جز را ویرایش کند', (_actor: Actor) => {
  return 'pending';
});

When('{actor} تلاش می کند آن جز را حذف کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن جز از سیستم حذف نشده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات جز جدید را وارد می کند', (_actor: Actor) => {
  return 'pending';
});

When('اسم جز را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای اسم جز نشان داده شود', () => {
  return 'pending';
});

When('{actor} اسم آن جز را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

Given('اینکه جزئی با اسم {string} در سیستم ثبت شده باشد', (_string: string) => {
  return 'pending';
});

When(
  '{actor} جز جدیدی با اسم {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('پیغام خطای تکراری بودن اسم جز نشان داده شود', () => {
  return 'pending';
});

Given(
  'اینکه جزئی با اسم {string} و جز دیگری با اسم {string} در سیستم ثبت شده باشد',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

When(
  '{actor} اسم جز {string} را به {string} تغییر می دهد',
  (_actor: Actor, _string1: string, _string2: string) => {
    return 'pending';
  },
);
