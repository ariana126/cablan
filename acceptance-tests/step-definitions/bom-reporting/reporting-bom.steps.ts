import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When(
  '{actor} لیست آنالیز های روزانه را بدون فیلتر مشاهده می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('تمام آنالیز های روزانه ثبت شده نمایش داده شود', () => {
  return 'pending';
});

When(
  '{actor} لیست آنالیز های روزانه را با فیلترهای زیر مشاهده می کند',
  (_actor: Actor, _table: DataTable) => {
    return 'pending';
  },
);

Then(
  'فقط آنالیز های روزانه با شماره سفارش {string} نمایش داده شود',
  (_string: string) => {
    return 'pending';
  },
);

Then(
  'وزن کل مواد اولیه هر آنالیز روزانه به صورت زیر نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با فیلتر شماره سفارش {string} مشاهده می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);
