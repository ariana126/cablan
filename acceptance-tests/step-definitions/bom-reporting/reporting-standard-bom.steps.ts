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

When(
  '{actor} لیست آنالیز های استاندارد را با فیلترهای زیر مشاهده می کند',
  (_actor: Actor, _table: DataTable) => {
    return 'pending';
  },
);

Then(
  'فقط آنالیز های استاندارد با کد MI {string} نمایش داده شود',
  (_string: string) => {
    return 'pending';
  },
);

Then(
  'وزن کل مواد اولیه هر آنالیز استاندارد به صورت زیر نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های استاندارد را با فیلتر برند {string} مشاهده می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);
