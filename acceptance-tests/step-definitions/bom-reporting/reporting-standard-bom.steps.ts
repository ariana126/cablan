import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When(
  '{actor} لیست آنالیز های استاندارد را بدون فیلتر مشاهده می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('تمام آنالیز های استاندارد ثبت شده نمایش داده شود', () => {
  return 'pending';
});

Then(
  'فقط آنالیز های استاندارد با کد MI {string} نمایش داده شود',
  (_string: string) => {
    return 'pending';
  },
);

Then(
  'آنالیز های استاندارد به ترتیب زیر نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} ترتیب مرتب سازی لیست آنالیز های استاندارد بر اساس نام محصول را معکوس می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

When(
  '{actor} جزئیات آنالیز استاندارد با کد MI {string} را باز می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده می کند',
  (_actor: Actor, _values: string, _field: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با انتخاب مقادیر زیر مشاهده می کند',
  (_actor: Actor, _table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با عدم انتخاب مقدار {string} برای فیلتر {string} مشاهده می کند',
  (_actor: Actor, _value: string, _field: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با عدم انتخاب همه مقادیر فیلتر {string} مشاهده می کند',
  (_actor: Actor, _field: string) => {
    return 'pending';
  },
);

When('{actor} لیست آنالیز های استاندارد را مشاهده می کند', (_actor: Actor) => {
  return 'pending';
});
