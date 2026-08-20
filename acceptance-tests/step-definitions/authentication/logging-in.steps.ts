import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';

Given(
  'اینکه کارمندی با نام کاربری {string} و رمز عبور {string} در سیستم ثبت شده باشد',
  (_string1: string, _string2: string) => {
    return 'pending';
  },
);

When(
  'آن کارمند با نام کاربری {string} و رمز عبور {string} وارد سیستم می شود',
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

Given('اینکه {actor} آن کارمند را از سیستم حذف کرده باشد', (_actor: Actor) => {
  return 'pending';
});
