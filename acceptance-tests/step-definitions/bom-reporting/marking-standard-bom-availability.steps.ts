import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

Then('آنالیز استاندارد جدید به صورت غیرفعال ثبت شده باشد', () => {
  return 'pending';
});

Given(
  'اینکه یک آنالیز استاندارد غیرفعال برای محصول {string} ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When('{actor} آن آنالیز استاندارد را فعال می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز استاندارد فعال شده باشد', () => {
  return 'pending';
});

Given(
  'اینکه یک آنالیز استاندارد فعال برای محصول {string} ثبت شده باشد',
  (_string: string) => {
    return 'pending';
  },
);

When('{actor} آن آنالیز استاندارد را غیرفعال می کند', (_actor: Actor) => {
  return 'pending';
});

Then('آنالیز استاندارد غیرفعال شده باشد', () => {
  return 'pending';
});

When(
  '{actor} تلاش می کند وضعیت فعال بودن آن آنالیز استاندارد را تغییر دهد',
  (_actor: Actor) => {
    return 'pending';
  },
);

Then('وضعیت آنالیز استاندارد تغییر نکرده باشد', () => {
  return 'pending';
});
