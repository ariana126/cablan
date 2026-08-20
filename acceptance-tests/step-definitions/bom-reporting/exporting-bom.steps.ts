import { When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

When(
  '{actor} لیست آنالیز های روزانه را بدون فیلتر به اکسل خروجی می گیرد',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('فایل اکسل تمام آنالیز های روزانه ثبت شده را شامل شود', () => {
  return 'pending';
});

When(
  '{actor} لیست آنالیز های روزانه را با فیلتر برند {string} به اکسل خروجی می گیرد',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then(
  'فایل اکسل فقط آنالیز های روزانه با شماره سفارش {string} را شامل شود',
  (_string: string) => {
    return 'pending';
  },
);

Then(
  'فایل اکسل شامل ردیف های زیر برای آنالیز روزانه با شماره سفارش {string} باشد',
  (_string: string, _table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با فیلتر شماره سفارش {string} به اکسل خروجی می گیرد',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);
