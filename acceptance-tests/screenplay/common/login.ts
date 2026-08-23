import {
  Masked,
  notes,
  Question,
  QuestionAdapter,
  Task,
  d,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  ChangeApiConfig,
  LastResponse,
  PostRequest,
  Send,
} from '@serenity-js/rest';

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
 * Logs the actor in via the real `POST /api/auth/login` endpoint and configures their ability to
 * `CallAnApi` so every subsequent request carries the resulting token — no scenario ever has to
 * remember to attach it itself.
 *
 * ASSUMPTION: login answers `200` with `{ accessToken }` — the dispatch that requested this
 * automation described the shape as "`{accessToken}` (or similar)" without a confirmed status
 * code; adjust the `equals(200)` below if the backend answers differently.
 */
export const LogIn = {
  viaApiUsing: (username: string, password: string): Task =>
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
};
