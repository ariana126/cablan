import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

Given(
  'اینکه آنالیز های استاندارد زیر با وزن استاندارد مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);

Given(
  'آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} داشبورد آنالیز های روزانه را بدون فیلتر مشاهده می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('تمام محصولات دارای آنالیز روزانه نمایش داده شود', () => {
  return 'pending';
});

When(
  'کاربری که وارد سیستم نشده تلاش می کند داشبورد آنالیز های روزانه را مشاهده کند',
  () => {
    return 'pending';
  },
);

When(
  '{actor} داشبورد آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} مشاهده می کند',
  (_actor: Actor, _from: string, _to: string) => {
    return 'pending';
  },
);

Then('لیست محصولات زیر نمایش داده شود', (_table: DataTable) => {
  return 'pending';
});

When(
  '{actor} محصول {string} را از داشبورد با بازه زمانی امروز انتخاب می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then(
  'آنالیز های روزانه با شماره سفارش {string} برای آن محصول نمایش داده شود',
  (_string: string) => {
    return 'pending';
  },
);

Then('لیست شامل موارد زیر باشد', (_table: DataTable) => {
  return 'pending';
});

Given(
  'اینکه آنالیز استاندارد و آنالیز روزانه زیر با وزن مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} آن آنالیز روزانه را در داشبورد مشاهده می کند',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then(
  'امتیاز آن آنالیز روزانه برابر {string} نمایش داده شود',
  (_string: string) => {
    return 'pending';
  },
);

Then(
  'آنالیز های روزانه به ترتیب زیر بر اساس امتیاز نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);
