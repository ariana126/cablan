import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

Then('آنالیز استاندارد جدیدی اضافه شده باشد', () => {
  return 'pending';
});

When('{actor} آنالیز استاندارد را ویرایش میکند', (_actor: Actor) => {
  return 'pending';
});

When('{actor} آنالیز استاندارد را حذف میکند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز استاندارد از سیستم حذف شده باشد', () => {
  return 'pending';
});

When(
  '{actor} تلاش می کند آنالیز استاندارد جدید برای محصول {string} ثبت کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('آنالیز استاندارد جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آنالیز استاندارد را ویرایش کند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز استاندارد ویرایش نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آنالیز استاندارد را حذف کند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز استاندارد از سیستم حذف نشده باشد', () => {
  return 'pending';
});

Given(
  'اینکه یک آنالیز استاندارد با کد MI {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When(
  '{actor} اطلاعات آنالیز استاندارد جدید برای محصول {string} وارد میکند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When('کد MI را {string} وارد میکند', (_string: string) => {
  return 'pending';
});

Then('پیغام خطای کد MI تکراری نشان داده شود', () => {
  return 'pending';
});

Given(
  'اینکه یک آنالیز استاندارد برای محصول {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When('{actor} کد MI آن را به کدی تکراری تغییر می دهد', (_actor: Actor) => {
  return 'pending';
});

When('کد MI را خالی میگذارد', () => {
  return 'pending';
});

Then('پیغام خطای کد MI نشان داده شود', () => {
  return 'pending';
});

When('{actor} کد MI آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('برند را خالی میگذارد', () => {
  return 'pending';
});

Then('پیغام خطای برند نشان داده شود', () => {
  return 'pending';
});

When('{actor} برند آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('متراژ استاندارد را خالی میگذارد', () => {
  return 'pending';
});

Then('پیغام خطای متراژ استاندارد نشان داده شود', () => {
  return 'pending';
});

When('{actor} متراژ استاندارد آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('{actor} چند جز برای آن آنالیز استاندارد ثبت می کند', (_actor: Actor) => {
  return 'pending';
});

Then('تمام اجزای ثبت شده به آنالیز استاندارد مربوط باشند', () => {
  return 'pending';
});

Given('اینکه یک جز برای یک آنالیز استاندارد در سیستم ثبت شده باشد', () => {
  return 'pending';
});
