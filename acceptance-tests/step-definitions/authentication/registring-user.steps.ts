import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When('{actor} کاربر جدیدی با اطلاعات معتبر ثبت می کند', (_actor: Actor) => {
  return 'pending';
});

Then('کاربر جدید در سیستم ثبت شده باشد', () => {
  return 'pending';
});

Given('اینکه یک کاربر در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات آن کاربر را ویرایش می کند', (_actor: Actor) => {
  return 'pending';
});

Then('اطلاعات ویرایش شده کاربر در سیستم ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} آن کاربر را حذف می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن کاربر از سیستم حذف شده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند لیست کاربران را مشاهده کند', (_actor: Actor) => {
  return 'pending';
});

Then('لیست کاربران نمایش داده نشود', () => {
  return 'pending';
});

When('{actor} تلاش می کند کاربر جدیدی ثبت کند', (_actor: Actor) => {
  return 'pending';
});

Then('کاربر جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند اطلاعات آن کاربر را ویرایش کند', (_actor: Actor) => {
  return 'pending';
});

Then('کاربر ویرایش نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آن کاربر را حذف کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن کاربر از سیستم حذف نشده باشد', () => {
  return 'pending';
});

When('{actor} اطلاعات کاربر جدید را وارد می کند', (_actor: Actor) => {
  return 'pending';
});

When('اسم کاربر را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای اسم کاربر نشان داده شود', () => {
  return 'pending';
});

When('{actor} اسم آن کاربر را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('نام کاربری را خالی می گذارد', () => {
  return 'pending';
});

Then('پیغام خطای نام کاربری نشان داده شود', () => {
  return 'pending';
});

When('{actor} نام کاربری آن کاربر را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

Given(
  'اینکه کاربری با نام کاربری {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When(
  '{actor} کاربر جدیدی با نام کاربری {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('پیغام خطای تکراری بودن نام کاربری نشان داده شود', () => {
  return 'pending';
});

Given(
  'اینکه کاربری با نام کاربری {string} و کاربر دیگری با نام کاربری {string} در سیستم ثبت شده باشد',
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

When('{actor} رمز عبور آن کاربر را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('نقشی نامعتبر برای او انتخاب می کند', () => {
  return 'pending';
});

Then('پیغام خطای نقش نامعتبر نشان داده شود', () => {
  return 'pending';
});

When(
  '{actor} کاربر جدیدی با نقش {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('کاربر جدید با نقش {string} در سیستم ثبت شده باشد', (_string: string) => {
  return 'pending';
});

When('{actor} نقش خودش را تغییر می دهد', (_actor: Actor) => {
  return 'pending';
});

Then('پیغام خطای عدم امکان تغییر نقش خود نشان داده شود', () => {
  return 'pending';
});
