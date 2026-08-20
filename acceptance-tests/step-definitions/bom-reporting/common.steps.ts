import { Given, Then, DataTable } from '@cucumber/cucumber';

// Steps whose text recurs across more than one .feature file within bom-reporting/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.

Given(
  'اینکه آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);

Then('فایل اکسل خالی باشد', () => {
  return 'pending';
});

Given(
  'اینکه آنالیز های استاندارد زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    return 'pending';
  },
);
