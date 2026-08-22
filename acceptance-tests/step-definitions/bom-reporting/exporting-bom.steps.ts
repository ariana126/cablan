import { Given, When } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

// The Then steps this feature shares with exporting-standard-bom.feature — none of them
// mention "روزانه" — are defined once in bom-reporting/common.steps.ts.

When(
  'کاربری که وارد سیستم نشده تلاش می کند از لیست آنالیز های روزانه خروجی اکسل بگیرد',
  () => {
    return 'pending';
  },
);

When(
  '{actor} از لیست آنالیز های روزانه با فرمت {string} خروجی اکسل می گیرد',
  (_actor: Actor, _format: string) => {
    return 'pending';
  },
);

Given(
  'اینکه {actor} لیست آنالیز های روزانه را با انتخاب مقادیر {string} برای فیلتر {string} مشاهده کرده باشد',
  (_actor: Actor, _values: string, _field: string) => {
    return 'pending';
  },
);
