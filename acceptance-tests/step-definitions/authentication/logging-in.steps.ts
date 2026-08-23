import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LetTimePass } from '../../screenplay/common/clock';
import { LogIn } from '../../screenplay/common/login';
import {
  AttemptToAccessTheSystem,
  DeleteLoginTestUser,
  EnsureAccessDenied,
  EnsureAccessGranted,
  EnsureAskedToLogInAgain,
  EnsureInvalidCredentialsMessageShown,
  loginAttemptActorName,
  LogOut,
  RegisterLoginTestUser,
  theLoginTestUser,
} from '../../screenplay/authentication/logging-in';

/**
 * The feature never names an actor — every scenario is either an anonymous visitor attempting to
 * log in or "that user" from the background — so every UI-driving step below acts as this one
 * fixed identity (`screenplay/authentication/logging-in.ts`), purely to give Serenity's
 * actor/spotlight machinery something to hang off.
 */
const theVisitor = () => actorCalled(loginAttemptActorName);

// پیش زمینه: با در نظر گرفتن اینکه کاربری با نام کاربری "sina.q" و رمز عبور "Passw0rd!" در سیستم
// ثبت شده باشد

Given(
  'اینکه کاربری با نام کاربری {string} و رمز عبور {string} در سیستم ثبت شده باشد',
  (username: string, password: string) =>
    actorCalled('یاشار').attemptsTo(RegisterLoginTestUser(username, password)),
);

// سناریو: ورود موفق کاربر
// قانون: ورود با رمز عبور نادرست مجاز نیست
// قانون: ورود با نام کاربری نامعتبر مجاز نیست
// قانون: نام کاربری به حروف بزرگ و کوچک حساس است

When(
  'آن کاربر با نام کاربری {string} و رمز عبور {string} وارد سیستم می شود',
  (username: string, password: string) =>
    theVisitor().attemptsTo(LogIn.using(username, password)),
);

When(
  'کاربری با نام کاربری {string} و رمز عبور {string} وارد سیستم می شود',
  (username: string, password: string) =>
    theVisitor().attemptsTo(LogIn.using(username, password)),
);

Then('به او دسترسی به سیستم داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAccessGranted()),
);

Then('دسترسی به او داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAccessDenied()),
);

Then('پیغام خطای نام کاربری یا رمز عبور نادرست نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureInvalidCredentialsMessageShown()),
);

// قانون: کاربر حذف شده نمی تواند وارد سیستم شود

Given('اینکه آن کاربر از سیستم حذف شده باشد', () =>
  actorCalled('یاشار').attemptsTo(DeleteLoginTestUser()),
);

// قانون: نشست کاربر پس از یک ساعت منقضی می شود
// قانون: کاربری که از سیستم خارج شده نمی تواند به سیستم دسترسی داشته باشد

Given('اینکه آن کاربر وارد سیستم شده باشد', () => {
  const { username, password } = theLoginTestUser();
  return theVisitor().attemptsTo(LogIn.using(username, password));
});

Given('یک ساعت گذشته باشد', () =>
  actorInTheSpotlight().attemptsTo(LetTimePass(60 * 60 * 1000)),
);

Given('از سیستم خارج شده باشد', () =>
  actorInTheSpotlight().attemptsTo(LogOut()),
);

When('او تلاش می کند به سیستم دسترسی داشته باشد', () =>
  actorInTheSpotlight().attemptsTo(AttemptToAccessTheSystem()),
);

Then('از او خواسته شود دوباره وارد سیستم شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAskedToLogInAgain()),
);
