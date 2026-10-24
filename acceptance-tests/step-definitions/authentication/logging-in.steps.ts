import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
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
  LogInWithTheRightPassword,
  LogOut,
  RegisterLoginTestUser,
  RegisterPersonaUnderUsername,
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

// قانون: نام کاربری وارد شده با رقم فارسی، همان نام کاربری با رقم انگلیسی است
//
// The Given names a persona, but `{actor}` cannot be used for it: «کاربری» is one Arabic-script
// word too, so «اینکه {actor} با نام کاربری {string} در سیستم ثبت شده باشد» would also match
// registring-user.feature's «اینکه کاربری با نام کاربری ... در سیستم ثبت شده باشد» and make it
// ambiguous. A regular expression that refuses «کاربری» as the name keeps the two apart. Its group
// is `\S+`, not `{actor}`'s own `[؀-ۿ]+`: Cucumber resolves a group whose source equals a parameter
// type's, and `{actor}`/`{actorName}` share that one, so it would reject the step as ambiguous.
// The account is set up by یاشار, so the persona's own actor is not summoned here; the When does.
//
// The Then («انتظار می رود سینا وارد سیستم شده باشد») is byte-identical to the shared
// «{actor} وارد سیستم شده باشد» precondition, so it is that definition
// (`step-definitions/common.steps.ts`), which checks access was granted when the actor has just
// tried to log in through the browser (`HasJustTriedToLogInThroughTheBrowser`).

Given(
  /^اینکه (?!کاربری )(\S+) با نام کاربری "([^"]*)" در سیستم ثبت شده باشد$/,
  (personaName: string, username: string) =>
    actorCalled('یاشار').attemptsTo(
      RegisterPersonaUnderUsername(personaName, username),
    ),
);

When(
  '{actor} با نام کاربری {string} و رمز عبور درست وارد سیستم می شود',
  (actor: Actor, username: string) =>
    actor.attemptsTo(LogInWithTheRightPassword(username)),
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
