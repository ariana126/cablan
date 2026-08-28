import {
  Answerable,
  Interaction,
  Masked,
  notes,
  Question,
  QuestionAdapter,
  Task,
  Wait,
  d,
} from '@serenity-js/core';
import { Ensure, equals, startsWith } from '@serenity-js/assertions';
import {
  ChangeApiConfig,
  LastResponse,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible, Navigate, Page } from '@serenity-js/web';
import { LoginPage } from '../ui/login-page';

export interface AuthNotes {
  username: string;
}

interface LoginResponseBody {
  accessToken: string;
}

/**
 * Reads the `accessToken` off the last login response and formats it as a `Bearer` header value,
 * resolved lazily so it always reflects whichever login just happened.
 */
const BearerToken = (): QuestionAdapter<string> =>
  Question.about('the bearer token for the last login', async (actor) => {
    const accessToken = await actor.answer(
      LastResponse.body<LoginResponseBody>().accessToken,
    );
    return `Bearer ${accessToken}`;
  });

/**
 * Polls until the site has had its say about a submitted login attempt — either the visitor was
 * taken to another page, or told what was wrong (`role="alert"` on `/login` itself). Submitting a
 * form means clicking *and* waiting for the answer; polling for either outcome is what lets this
 * task cover both without knowing in advance which one is coming.
 *
 * Written as a manual poll rather than composed from `Wait.until` twice, because
 * `Interaction.where`'s callback actor has no `attemptsTo` of its own to run either `Wait` on —
 * only `answer`, which is enough to read both the current URL and whether the alert has appeared.
 */
const WaitForTheLoginAttemptToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the login attempt to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const pathname = await actor.answer(Page.current().url().pathname);
        if (pathname !== '/login') {
          return;
        }
        const errorMessage = await actor.answer(LoginPage.errorMessage());
        if (await errorMessage.isVisible()) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
    },
  );

export const LogIn = {
  /**
   * Logs the actor in via the real `POST /api/auth/login` endpoint and configures their ability
   * to `CallAnApi` so every subsequent request carries the resulting token — no scenario ever has
   * to remember to attach it itself.
   *
   * ASSUMPTION: login answers `200` with `{ accessToken }` — the dispatch that requested this
   * automation described the shape as "`{accessToken}` (or similar)" without a confirmed status
   * code; adjust the `equals(200)` below if the backend answers differently.
   *
   * Accepts `Answerable<string>` rather than a plain `string` (like `using` below already does)
   * so a caller can re-authenticate with credentials read back off the acting actor's own notepad
   * — `AuthNotes`/`PersonaCredentialsNotes`, both set by `screenplay/common/personas.ts#LogInAsPersona`
   * — without needing the raw strings in scope. `bom-reporting`'s own fixture setup is the first
   * real call site: a persona re-authenticating for a later group needs a *fresh* token (a JWT's
   * `iat`/`exp` are stamped from whatever the backend's test clock currently reads, and that
   * fixture moves it across days/months of Jalali time — see `screenplay/common/clock.ts`'s own
   * module comment), but must not re-provision an account that already exists.
   */
  viaApiUsing: (
    username: Answerable<string>,
    password: Answerable<string>,
  ): Task =>
    Task.where(
      d`#actor logs in as ${username}`,
      Send.a(
        PostRequest.to('auth/login').with(
          Question.fromObject({ username, password: Masked.valueOf(password) }),
        ),
      ),
      Ensure.that(LastResponse.status(), equals(200)),
      notes<AuthNotes>().set('username', username),
      ChangeApiConfig.setHeader('Authorization', Masked.valueOf(BearerToken())),
    ),

  /**
   * Logs the actor in through the real `/login` page: navigates there, fills the two labelled
   * fields, submits, and waits for the site to answer. Used wherever a scenario demonstrates the
   * act of logging in through the UI, rather than merely needing a signed-in actor
   * (`viaApiUsing` above covers that case).
   *
   * Accepts `Answerable<string>` rather than a plain `string` for both parameters so a caller can
   * pass a value resolved from the acting actor's own notepad (e.g.
   * `screenplay/bom-registration/materials-form.ts`'s `EstablishBrowserSession`, which doesn't know
   * in advance which persona will perform the task).
   */
  using: (username: Answerable<string>, password: Answerable<string>): Task =>
    Task.where(
      d`#actor logs in as ${username}`,
      Navigate.to('/login'),
      Wait.until(LoginPage.usernameField(), isVisible()),
      Enter.theValue(username).into(LoginPage.usernameField()),
      Enter.theValue(Masked.valueOf(password)).into(LoginPage.passwordField()),
      Click.on(LoginPage.submitButton()),
      WaitForTheLoginAttemptToBeAnswered(),
    ),
};

/**
 * "از او خواسته شود وارد سیستم شود" — the generic route-guard redirect shared across every feature
 * area that lets an unauthenticated visitor attempt a protected page and expects to be sent to
 * `/login` (`step-definitions/common.steps.ts`, currently: bom-analyzing, bom-reporting's exports
 * and both its report features). Page-agnostic on purpose: it never needs to know which page the
 * visitor was actually trying to reach, only that they ended up here — mirrors
 * `screenplay/authentication/logging-in.ts#EnsureAskedToLogInAgain`'s own shape, which is scoped to
 * that feature's own `loginAttemptActorName` instead and so isn't reusable from here (see this
 * suite's convention: reusable-across-feature-areas belongs in `screenplay/common/`).
 */
export const EnsureRedirectedToLogIn = (): Task =>
  Task.where(
    '#actor ensures they were redirected to the login page',
    Wait.until(Page.current().url().pathname, startsWith('/login')),
    Ensure.that(LoginPage.usernameField(), isVisible()),
  );
