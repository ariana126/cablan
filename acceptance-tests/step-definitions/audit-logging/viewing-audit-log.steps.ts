import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

Given('اینکه رویدادهای زیر در سیستم ثبت شده باشند:', (_table: DataTable) => {
  return 'pending';
});

When(
  '{actor} لیست رویدادهای سیستم را بدون فیلتر مشاهده می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then(
  'رویدادهای ردیف زیر از جدیدترین به قدیمی‌ترین نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} لیست رویدادهای سیستم را با فیلترهای زیر مشاهده می کند',
  (_actor: Actor, _table: DataTable) => {
    return 'pending';
  },
);

Then('فقط رویدادهای ردیف {string} نمایش داده شود', (_string: string) => {
  return 'pending';
});

When(
  '{actor} لیست رویدادهای سیستم را با فیلتر کاربر {string} مشاهده می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When(
  '{actor} تلاش می کند لیست رویدادهای سیستم را مشاهده کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('رویدادهای سیستم نمایش داده نشود', () => {
  return 'pending';
});

Given(
  'اینکه رویداد ویرایش زیر با جزئیات تغییرات آن در سیستم ثبت شده باشد:',
  (_table: DataTable) => {
    return 'pending';
  },
);

When('{actor} جزئیات آن رویداد را مشاهده می کند', (_actor: Actor) => {
  return 'pending';
});

Then(
  'جزئیات تغییرات آن رویداد به صورت زیر نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);
