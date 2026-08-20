import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When(
  '{actor} لیست آنالیز های استاندارد را بدون فیلتر به اکسل خروجی می گیرد',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('فایل اکسل تمام آنالیز های استاندارد ثبت شده را شامل شود', () => {
  return 'pending';
});

When(
  '{actor} لیست آنالیز های استاندارد را با فیلتر برند {string} به اکسل خروجی می گیرد',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با فیلتر برند در حالت {string} با مقدار {string} به اکسل خروجی می گیرد',
  (_actor: Actor, _mode: string, _value: string) => {
    return 'pending';
  },
);

Then(
  'فایل اکسل فقط آنالیز های استاندارد با کد MI {string} را شامل شود',
  (_string: string) => {
    return 'pending';
  },
);

Then(
  'فایل اکسل شامل ردیف های زیر برای آنالیز استاندارد با کد MI {string} باشد',
  (_string: string, _table: DataTable) => {
    return 'pending';
  },
);
