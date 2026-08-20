import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When('{actor} کارمند جدیدی با اطلاعات معتبر ثبت می کند', (_actor: Actor) => {
  return 'pending';
});

Then('کارمند جدید در سیستم ثبت شده باشد', () => {
  return 'pending';
});

Given('اینکه یک کارمند در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات آن کارمند را ویرایش می کند', (_actor: Actor) => {
  return 'pending';
});

Then('اطلاعات ویرایش شده کارمند در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} آن کارمند را حذف می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن کارمند از سیستم حذف شده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند کارمند جدیدی ثبت کند', (_actor: Actor) => {
  return 'pending';
});

Then('کارمند جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند اطلاعات آن کارمند را ویرایش کند', (_actor: Actor) => {
  return 'pending';
});

Then('کارمند ویرایش نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آن کارمند را حذف کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن کارمند از سیستم حذف نشده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات کارمند جدید را وارد می کند', (_actor: Actor) => {
  return 'pending';
});

When('اسم کارمند را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای اسم کارمند نشان داده شود', () => {
  return 'pending';
});

When('{actor} اسم آن کارمند را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('نام کاربری را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای نام کاربری نشان داده شود', () => {
  return 'pending';
});

When('{actor} نام کاربری آن کارمند را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

Given(
  'اینکه کارمندی با نام کاربری {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When(
  '{actor} کارمند جدیدی با نام کاربری {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('پیغام خطای تکراری بودن نام کاربری نشان داده شود', () => {
  return 'pending';
});

Given(
  'اینکه کارمندی با نام کاربری {string} و کارمند دیگری با نام کاربری {string} در سیستم ثبت شده باشد',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

When(
  '{actor} نام کاربری {string} را به {string} تغییر می دهد',
  (_actor: Actor, _string1: string, _string2: string) => {
    return 'pending';
  },
);

When('رمز عبور را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای رمز عبور نشان داده شود', () => {
  return 'pending';
});

When('{actor} رمز عبور آن کارمند را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('نقشی نامعتبر برای او انتخاب می کند', () => {
  return 'pending';
});

Then('پیغام خطای نقش نامعتبر نشان داده شود', () => {
  return 'pending';
});
