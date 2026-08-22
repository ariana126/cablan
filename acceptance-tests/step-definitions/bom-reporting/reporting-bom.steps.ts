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

Then(
  'فقط آنالیز های روزانه با شماره سفارش {string} نمایش داده شود',
  (_string: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با تاریخ و زمان ثبت بین {string} و {string} مشاهده می کند',
  (_actor: Actor, _from: string, _to: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با تاریخ و زمان ثبت از {string} تا اکنون مشاهده می کند',
  (_actor: Actor, _from: string) => {
    return 'pending';
  },
);

Then('آنالیز های روزانه به ترتیب زیر نمایش داده شود', (_table: DataTable) => {
  return 'pending';
});

When(
  '{actor} جزئیات آنالیز روزانه با شماره سفارش {string} را باز می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده می کند',
  (_actor: Actor, _values: string, _field: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با انتخاب مقادیر زیر مشاهده می کند',
  (_actor: Actor, _table: DataTable) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با عدم انتخاب مقدار {string} برای فیلتر {string} مشاهده می کند',
  (_actor: Actor, _value: string, _field: string) => {
    return 'pending';
  },
);

When(
  '{actor} لیست آنالیز های روزانه را با عدم انتخاب همه مقادیر فیلتر {string} مشاهده می کند',
  (_actor: Actor, _field: string) => {
    return 'pending';
  },
);

When('{actor} لیست آنالیز های روزانه را مشاهده می کند', (_actor: Actor) => {
  return 'pending';
});

When(
  'کاربری که وارد سیستم نشده تلاش می کند لیست آنالیز های روزانه را مشاهده کند',
  () => {
    return 'pending';
  },
);
