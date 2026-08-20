import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When(
  '{actor} مواد اولیه جدیدی با اطلاعات معتبر ثبت می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('مواد اولیه جدیدی در سیستم ثبت شده باشد', () => {
  return 'pending';
});

Given('اینکه یک مواد اولیه در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات آن مواد اولیه را ویرایش می کند', (_actor: Actor) => {
  return 'pending';
});

Then('اطلاعات ویرایش شده مواد اولیه در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} آن مواد اولیه را حذف می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن مواد اولیه از سیستم حذف شده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند مواد اولیه جدیدی ثبت کند', (_actor: Actor) => {
  return 'pending';
});

Then('مواد اولیه جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

When(
  '{actor} تلاش می کند اطلاعات آن مواد اولیه را ویرایش کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('مواد اولیه ویرایش نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آن مواد اولیه را حذف کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن مواد اولیه از سیستم حذف نشده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات مواد اولیه جدید را وارد می کند', (_actor: Actor) => {
  return 'pending';
});

When('اسم مواد اولیه را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای اسم مواد اولیه نشان داده شود', () => {
  return 'pending';
});

When('{actor} اسم آن مواد اولیه را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

Given(
  'اینکه مواد اولیه ای با اسم {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When(
  '{actor} مواد اولیه جدیدی با اسم {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('پیغام خطای تکراری بودن اسم مواد اولیه نشان داده شود', () => {
  return 'pending';
});

Given(
  'اینکه مواد اولیه ای با اسم {string} و مواد اولیه دیگری با اسم {string} در سیستم ثبت شده باشد',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

When(
  '{actor} اسم مواد اولیه {string} را به {string} تغییر می دهد',
  (_actor: Actor, _string1: string, _string2: string) => {
    return 'pending';
  },
);
