import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

Given(
  'اینکه آنالیز استانداردی با کد MI {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When(
  '{actor} آنالیز روزانه جدید برای کد MI {string} ثبت می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('آنالیز روزانه جدیدی ثبت شده باشد', () => {
  return 'pending';
});

Given(
  'اینکه یک آنالیز روزانه برای کد MI {string} در سیستم ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When('{actor} آن را ویرایش می کند', (_actor: Actor) => {
  return 'pending';
});

When('{actor} آن را حذف می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن آنالیز روزانه از سیستم حذف شده باشد', () => {
  return 'pending';
});

When(
  '{actor} تلاش می کند آنالیز روزانه جدید برای کد MI {string} ثبت کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('آنالیز روزانه جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آن را ویرایش کند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز روزانه ویرایش نشده باشد', () => {
  return 'pending';
});

When('{actor} تلاش می کند آن را حذف کند', (_actor: Actor) => {
  return 'pending';
});

Then('آن آنالیز روزانه از سیستم حذف نشده باشد', () => {
  return 'pending';
});

When(
  '{actor} اطلاعات آنالیز جدید برای کد MI {string} وارد میکند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When('شماره سفارش را خالی میگذارد', () => {
  return 'pending';
});

Then('آنالیز جدیدی ثبت نشده باشد', () => {
  return 'pending';
});

Then('پیغام خطای شماره سفارش نشان داده شود', () => {
  return 'pending';
});

When('{actor} شماره شفارش آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When(
  '{actor} اطلاعات آنالیز روزانه جدید برای کد MI {string} وارد میکند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When('شماره ردیابی را خالی میگذارد', () => {
  return 'pending';
});

Then('پیغام خطای شماره ردیابی نشان داده شود', () => {
  return 'pending';
});

When('{actor} شماره ردیابی آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

When('وزن هر یک از مواد اولیه ها را خالی میگذارد', () => {
  return 'pending';
});

Then('پیغام خطای وزن مواد اولیه نامعتبر نشان داده شود', () => {
  return 'pending';
});

When('{actor} وزن یکی از مواد اولیه آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

Then('پیغام خطای وزن مواد اولیه نامعتبر داده شود', () => {
  return 'pending';
});

When('وزن هر یک از مواد اولیه ها را صفر میگذارد', () => {
  return 'pending';
});

When('{actor} وزن یکی از مواد اولیه آن را صفر می کند', (_actor: Actor) => {
  return 'pending';
});

When('توضیحات را خالی میگذراد', () => {
  return 'pending';
});

Then('آنالیز جدیدی ثبت شده باشد', () => {
  return 'pending';
});

When('{actor} توضیحیات آن را پاک می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز روزانه ویرایش شده باشد', () => {
  return 'pending';
});
