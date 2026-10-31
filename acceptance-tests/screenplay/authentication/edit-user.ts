import {
  d,
  Expectation,
  Masked,
  notes,
  Question,
  QuestionAdapter,
  Task,
} from '@serenity-js/core';
import {
  and,
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  isLessThan,
  property,
} from '@serenity-js/assertions';
import { LastResponse, PatchRequest, Send } from '@serenity-js/rest';
import { AuthNotes } from '../common/login';
import { apiRoleFor, SystemRole } from '../common/roles';
import { EnsureProblemDetail } from '../common/problem-detail';
import { personaIdentity } from '../common/personas';
import { NewUserDetails, theLastRegisteredUser } from './user-details';
import { TheUserList, UserSummary, ViewUserList } from './view-user-list';

const editRequestBody = (changes: Partial<NewUserDetails>) => {
  const body: Record<string, unknown> = {};
  if (changes.name !== undefined) body.name = changes.name;
  if (changes.username !== undefined) body.username = changes.username;
  if (changes.password !== undefined)
    body.password = Masked.valueOf(changes.password);
  if (changes.role !== undefined) body.role = apiRoleFor(changes.role);
  return Question.fromObject(body);
};

export const EditUser = {
  viaApiUsing: (id: string, changes: Partial<NewUserDetails>): Task =>
    Task.where(
      d`#actor edits user ${id}`,
      Send.a(PatchRequest.to(`users/${id}`).with(editRequestBody(changes))),
    ),
};

export const EnsureUserWasEditedWith = (
  changes: Partial<NewUserDetails>,
): Task => {
  const target = theLastRegisteredUser();
  const expectations: Expectation<UserSummary>[] = [
    property('id', equals(target.id)),
  ];
  if (changes.name !== undefined) {
    expectations.push(property('name', equals(changes.name)));
  }
  if (changes.username !== undefined) {
    expectations.push(property('username', equals(changes.username)));
  }
  if (changes.role !== undefined) {
    expectations.push(property('role', equals(apiRoleFor(changes.role))));
  }
  // Password is intentionally not checked here — the list endpoint never returns it
  // (`UserReadModel`'s own comment: "never carries a password hash").

  return Task.where(
    d`#actor ensures ${target.username} was edited`,
    // 204 No Content, the same success convention DELETE uses (see EnsureUserWasDeleted) — PATCH
    // has no representation of the updated resource to return.
    Ensure.that(LastResponse.status(), isLessThan(300)),
    ViewUserList(),
    Ensure.that(TheUserList(), containAtLeastOneItemThat(and(...expectations))),
  );
};

export const EnsureUserWasNotEdited = (): Task =>
  Task.where(
    '#actor ensures the user was not edited',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );

/**
 * Looks the current actor's own id up from the user list by the username they logged in with
 * (`screenplay/common/login.ts` records it in their notepad) — nothing about `POST /auth/login`'s
 * response identifies the account beyond issuing a token, so this is the only door available.
 * Requires `ViewUserList()` to have already run.
 */
const TheCurrentActorsUserId = (): QuestionAdapter<string> =>
  Question.about("the current actor's own user id", async (actor) => {
    const username = await actor.answer(notes<AuthNotes>().get('username'));
    const users = await actor.answer(TheUserList());
    const match = users.find((user) => user.username === username);
    if (!match) {
      throw new Error(
        `Could not find "${username}" in the user list to determine their own id.`,
      );
    }
    return match.id;
  });

export const ChangeOwnRole = (newRole: SystemRole): Task =>
  Task.where(
    d`#actor changes their own role to "${newRole}"`,
    ViewUserList(),
    Send.a(
      PatchRequest.to(
        Question.about(
          "the current actor's own user path",
          async (actor) =>
            `users/${await actor.answer(TheCurrentActorsUserId())}`,
        ),
      ).with(Question.fromObject({ role: apiRoleFor(newRole) })),
    ),
  );

/** The listed user with this username — from the last `ViewUserList()`. */
const TheListedUserCalled = (username: string): QuestionAdapter<UserSummary> =>
  Question.about(d`the listed user "${username}"`, async (actor) => {
    const users = await actor.answer(TheUserList());
    const match = users.find((user) => user.username === username);
    if (!match) {
      throw new Error(`Could not find "${username}" in the user list.`);
    }
    return match;
  });

/**
 * «نقش {persona} توسط {admin} از «…» به «…» تغییر داده شده باشد» (home's role-change rule) — the
 * acting admin finds the persona's account in the user list, checks it really holds the role the
 * step changes it from, and edits its role (`PATCH users/:id`). The persona's account must exist
 * already: `LogInAsPersona` provisions it.
 */
export const ChangeRoleOfPersona = (
  personaName: string,
  from: SystemRole,
  to: SystemRole,
): Task => {
  const { username } = personaIdentity(personaName);
  const user = TheListedUserCalled(username);
  return Task.where(
    d`#actor changes ${personaName}'s role from "${from}" to "${to}"`,
    ViewUserList(),
    Ensure.that(user.role, equals(apiRoleFor(from))),
    Send.a(
      PatchRequest.to(
        Question.about(d`the path of user "${username}"`, async (actor) => {
          const { id } = await actor.answer(user);
          return `users/${id}`;
        }),
      ).with({ role: apiRoleFor(to) }),
    ),
    Ensure.that(LastResponse.status(), isLessThan(300)),
  );
};

/** `backend/.../identity/application/exceptions/cannot-change-own-role.exception.ts`. */
export const EnsureCannotChangeOwnRole = (): Task =>
  Task.where(
    '#actor ensures they cannot change their own role',
    // ASSUMPTION: 409, and slug "cannot-change-own-role" — same caveat as
    // EnsureUsernameWasAlreadyTaken: the exception exists, but no HTTP layer or exception-mapper
    // entry for it yet at the time this was written.
    EnsureProblemDetail(409, 'cannot-change-own-role'),
  );
