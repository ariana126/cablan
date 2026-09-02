import { d, Interaction, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, startsWith } from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible, Navigate, Page, Text } from '@serenity-js/web';
import { LogInAsPersona } from '../common/personas';
import { LoginPage } from '../ui/login-page';
import { AppShell } from '../ui/app-shell';
import { HomePage, homePageGreeting } from '../ui/home-page';
import { RegisterUser } from './register-user';

/**
 * The identity every UI-driving step in this feature acts as.
 * `specs/authentication/logging-in.feature` never names an actor — every scenario is either an
 * anonymous visitor attempting to log in, or "that user" from the background — so this is one
 * fixed identity to hang Serenity's actor/spotlight machinery off. It carries no persona of its
 * own (unlike `screenplay/common/personas.ts`'s cast) because the feature has no business
 * identity for it beyond "whoever is trying to log in right now".
 */
export const loginAttemptActorName = 'بازدیدکننده';

export interface LoginTestUser {
  id: string;
  username: string;
  password: string;
}

/**
 * The one user the background registers, remembered so a later step can delete it
 * (`DeleteLoginTestUser`) or log in as it again (`اینکه آن کاربر وارد سیستم شده باشد`) without the
 * Gherkin having to repeat the username/password a second time. Plain module state, the same way
 * `screenplay/authentication/user-details.ts`'s `lastRegisteredUser` is: every scenario starts
 * from a truncated database (`support/hooks.ts`), so nothing here needs resetting between
 * scenarios — it is simply overwritten before it is next read.
 */
let lastLoginTestUser: LoginTestUser | undefined;

export const theLoginTestUser = (): LoginTestUser => {
  if (!lastLoginTestUser) {
    throw new Error(
      'No user has been registered yet for the login feature — expected the background step ' +
        '"اینکه کاربری با نام کاربری ... و رمز عبور ... در سیستم ثبت شده باشد" to have run first.',
    );
  }
  return lastLoginTestUser;
};

const RememberLoginTestUser = (
  username: string,
  password: string,
): Interaction =>
  Interaction.where(
    d`#actor remembers "${username}" as the login test user`,
    async (actor) => {
      const body = await actor.answer(LastResponse.body<{ id: string }>());
      lastLoginTestUser = { id: body.id, username, password };
    },
  );

/**
 * Registers a user with the exact username/password the feature file specifies (rather than the
 * generated `freshUserDetails()` other authentication features use), through یاشار's own admin
 * access — this is background test-data setup over the API, never through the UI; the UI is what
 * the scenarios themselves exercise.
 */
export const RegisterLoginTestUser = (
  username: string,
  password: string,
): Task =>
  Task.where(
    d`#actor registers a user with username "${username}" for the login feature`,
    LogInAsPersona('یاشار'),
    RegisterUser.viaApiUsing({
      name: 'کاربر آزمایش ورود',
      username,
      password,
      role: 'گزارشگیر',
    }),
    RememberLoginTestUser(username, password),
  );

/** The "کاربر حذف شده" rule's precondition — deletes the background-registered user via the API. */
export const DeleteLoginTestUser = (): Task =>
  Task.where(
    '#actor deletes the login test user',
    LogInAsPersona('یاشار'),
    Send.a(DeleteRequest.to(`users/${theLoginTestUser().id}`)),
  );

/**
 * "به او دسترسی به سیستم داده شود" — a successful log-in lands on the home page, whatever the
 * user's role: it is the one destination every role may reach, and the sections it lists are
 * already filtered to that role. Any one section would be the wrong assertion here, since the
 * feature's own user is a گزارشگیر (Reporter), who is withheld from most of them.
 */
export const EnsureAccessGranted = (): Task =>
  Task.where(
    '#actor ensures access was granted',
    Wait.until(Page.current().url().pathname, equals('/')),
    // Waited for, not asserted once: the router updates the URL as it activates the route, and
    // the page itself renders a change-detection pass later — this suite's waiting convention
    // everywhere else a page is arrived at.
    Wait.until(HomePage.heading(), isVisible()),
    // The heading's *text*, because a route this user may not reach renders the not-found page in
    // place — same URL, same single h1, different words. The greeting is what tells them apart.
    Ensure.that(Text.of(HomePage.heading()), startsWith(homePageGreeting)),
  );

export const EnsureAccessDenied = (): Task =>
  Task.where(
    '#actor ensures access was denied',
    Wait.until(Page.current().url().pathname, startsWith('/login')),
  );

/**
 * "از او خواسته شود دوباره وارد سیستم شود" — builds on `EnsureAccessDenied` (redirected to
 * `/login`) with the one distinguishing fact that makes it a genuine prompt to log in again: the
 * login form itself has actually rendered, not just the URL.
 */
export const EnsureAskedToLogInAgain = (): Task =>
  Task.where(
    '#actor ensures they were asked to log in again',
    EnsureAccessDenied(),
    Ensure.that(LoginPage.usernameField(), isVisible()),
  );

export const EnsureInvalidCredentialsMessageShown = (): Task =>
  Task.where(
    '#actor ensures the invalid-credentials message was shown',
    Wait.until(LoginPage.errorMessage(), isVisible()),
    Ensure.that(
      Text.of(LoginPage.errorMessage()),
      equals('نام کاربری یا رمز عبور نادرست است.'),
    ),
  );

export const LogOut = (): Task =>
  Task.where(
    '#actor logs out',
    Click.on(AppShell.logOutButton()),
    Wait.until(Page.current().url().pathname, startsWith('/login')),
  );

/**
 * The generic "او تلاش می کند به سیستم دسترسی داشته باشد" step — reused by two different rules.
 * Home, rather than any one section: the feature's user is a گزارشگیر (Reporter), and every other
 * page is one some role is withheld from, which would make "denied" ambiguous between "no session"
 * and "wrong role".
 */
export const AttemptToAccessTheSystem = (): Task =>
  Task.where('#actor attempts to access the system', Navigate.to('/'));
