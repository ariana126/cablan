import { Given, When, Then } from '@cucumber/cucumber';

Given(
  'اینکه کاربری با نام کاربری {string} و رمز عبور {string} در سیستم ثبت شده باشد',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

When(
  'آن کاربر با نام کاربری {string} و رمز عبور {string} وارد سیستم می شود',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

Then('به او دسترسی به سیستم داده شود', () => {
  return 'pending';
});

Then('دسترسی به او داده نشود', () => {
  return 'pending';
});

Then('پیغام خطای نام کاربری یا رمز عبور نادرست نشان داده شود', () => {
  return 'pending';
});

When(
  'کاربری با نام کاربری {string} و رمز عبور {string} وارد سیستم می شود',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

Given('اینکه آن کاربر از سیستم حذف شده باشد', () => {
  return 'pending';
});

Given('اینکه آن کاربر وارد سیستم شده باشد', () => {
  return 'pending';
});

Given('یک ساعت گذشته باشد', () => {
  return 'pending';
});

When('او تلاش می کند به سیستم دسترسی داشته باشد', () => {
  return 'pending';
});

Then('از او خواسته شود دوباره وارد سیستم شود', () => {
  return 'pending';
});

Given('از سیستم خارج شده باشد', () => {
  return 'pending';
});
