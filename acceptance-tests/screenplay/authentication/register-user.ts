import { d, Interaction, Masked, Question, Task } from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  property,
} from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { anInvalidApiRole, apiRoleFor } from '../common/roles';
import { EnsureProblemDetail } from '../common/problem-detail';
import {
  NewUserDetails,
  rememberAttempt,
  rememberRegisteredUser,
  theAttempt,
} from './user-details';
import { TheUserList, ViewUserList } from './view-user-list';

const registerRequestBody = (details: NewUserDetails, apiRole: string) =>
  Question.fromObject({
    name: details.name,
    username: details.username,
    password: Masked.valueOf(details.password),
    role: apiRole,
  });

export const RegisterUser = {
  /** Registers a user with one of the system's four valid roles. */
  viaApiUsing: (details: NewUserDetails): Task =>
    Task.where(
      d`#actor registers a new user "${details.username}"`,
      Send.a(
        PostRequest.to('users').with(
          registerRequestBody(details, apiRoleFor(details.role)),
        ),
      ),
    ),

  /**
   * Registers with a raw role value that bypasses `SystemRole`'s closed union — the one place
   * this suite needs to submit a role the system doesn't recognise, for the invalid-role rule.
   */
  viaApiUsingRawRole: (details: NewUserDetails, rawRole: string): Task =>
    Task.where(
      d`#actor registers a new user "${details.username}" with role "${rawRole}"`,
      Send.a(
        PostRequest.to('users').with(registerRequestBody(details, rawRole)),
      ),
    ),
};

const RememberTheRegisteredUser = (username: string): Interaction =>
  Interaction.where(
    d`#actor remembers "${username}" as the target user`,
    async (actor) => {
      const body = await actor.answer(LastResponse.body<{ id: string }>());
      rememberRegisteredUser({ id: body.id, username });
    },
  );

/**
 * Registers a user and remembers it as "the last registered user"/"the user with username X"
 * (`screenplay/authentication/user-details.ts`), for scenarios that go on to edit or delete it —
 * possibly as a *different* actor than the one performing this task, which is why the id is
 * captured from the response rather than left for the next step to work out.
 */
export const RegisterUserAndRememberIt = (details: NewUserDetails): Task =>
  Task.where(
    d`#actor registers "${details.username}" and remembers it as the target user`,
    RegisterUser.viaApiUsing(details),
    RememberTheRegisteredUser(details.username),
  );

export const EnsureUserWasRegistered = (details: NewUserDetails): Task =>
  Task.where(
    d`#actor ensures "${details.username}" was registered`,
    Ensure.that(LastResponse.status(), equals(201)),
    ViewUserList(),
    Ensure.that(
      TheUserList(),
      containAtLeastOneItemThat(
        and(
          property('username', equals(details.username)),
          property('name', equals(details.name)),
          property('role', equals(apiRoleFor(details.role))),
        ),
      ),
    ),
  );

export const EnsureNewUserWasNotRegistered = (): Task =>
  Task.where(
    '#actor ensures a new user was not registered',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

/** `backend/.../identity/application/exceptions/username-already-exists.exception.ts`. */
export const EnsureUsernameWasAlreadyTaken = (): Task =>
  Task.where(
    '#actor ensures the username was already taken',
    // ASSUMPTION: 409, and slug "username-already-exists" — the identity module has this
    // exception (`UsernameAlreadyExists`) but no HTTP layer or exception-mapper entry for it yet
    // at the time this was written, so neither the status nor the slug is confirmed.
    EnsureProblemDetail(409, 'username-already-exists'),
  );

/**
 * Drafts a fresh, valid set of new-user details without submitting them yet, remembering them
 * (`screenplay/authentication/user-details.ts`) so a following step can override just the one
 * field the scenario cares about and submit that. Wrapped in an `Interaction` (rather than left as
 * a bare synchronous call) purely so it shows up as its own step in the report — it makes no
 * request of its own.
 */
export const EnterNewUserDetails = (details: NewUserDetails): Task =>
  Task.where(
    '#actor enters new user details',
    Interaction.where('#actor drafts the new user details', () => {
      rememberAttempt<NewUserDetails>(details);
    }),
  );

/**
 * Overrides one field of the drafted details (see `EnterNewUserDetails`) and submits the
 * registration attempt — the "اما ... را خالی می گذارد" steps' shared shape. Reads and re-remembers
 * the attempt synchronously, at the moment the calling step definition invokes this factory
 * (i.e. after the preceding `EnterNewUserDetails` step has already resolved), not as a separate,
 * independently-scheduled activity — so there's no risk of it running before the draft exists.
 */
export const AttemptToRegisterLeavingEmpty = (
  field: 'name' | 'username' | 'password',
): Task => {
  const details: NewUserDetails = {
    ...theAttempt<NewUserDetails>(),
    [field]: '',
  };
  rememberAttempt<NewUserDetails>(details);
  return Task.where(
    d`#actor attempts to register a new user leaving ${field} empty`,
    RegisterUser.viaApiUsing(details),
  );
};

/** The "اما نقشی نامعتبر برای او انتخاب می کند" step: submits the draft with an invalid role. */
export const AttemptToRegisterWithInvalidRole = (): Task => {
  const details = theAttempt<NewUserDetails>();
  return Task.where(
    '#actor attempts to register a new user with an invalid role',
    RegisterUser.viaApiUsingRawRole(details, anInvalidApiRole),
  );
};
