import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

// Steps whose text recurs across more than one .feature file within bom-reporting/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.

Given(
  'اینکه آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);

Given(
  'اینکه آنالیز های استاندارد زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);

Then('لیست فقط شامل ستون های زیر باشد', (_table: DataTable) => {
  return 'pending';
});

Then(
  'جزئیات اجزا و مواد اولیه به صورت زیر نمایش داده شود',
  (_table: DataTable) => {
    return 'pending';
  },
);

Then('متراژ استاندارد {string} نمایش داده شود', (_string: string) => {
  return 'pending';
});

Then('توضیحات {string} نمایش داده شود', (_string: string) => {
  return 'pending';
});

Then('جمع وزن مواد اولیه {string} نمایش داده شود', (_string: string) => {
  return 'pending';
});

Given(
  'اینکه {actor} فیلتر {string} را با عدم انتخاب مقدار {string} اعمال کرده باشد',
  (_actor: Actor, _field: string, _value: string) => {
    return 'pending';
  },
);

When(
  '{actor} همه مقادیر فیلتر {string} را دوباره انتخاب می کند',
  (_actor: Actor, _string: string) => {
    return 'pending';
  },
);

Then('وزن مواد اولیه در فیلدهای قابل فیلتر نمایش داده نشود', () => {
  return 'pending';
});
