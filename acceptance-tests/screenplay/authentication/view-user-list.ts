import { QuestionAdapter, Task } from '@serenity-js/core';
import { Ensure, isGreaterThan } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * Mirrors the backend's `UserReadModel`
 * (`backend/src/modules/identity/application/queries/list-users/user.read-model.ts`): never a
 * password hash, `role` the same wire-level string `screenplay/common/roles.ts#apiRoleFor`
 * produces.
 */
export interface UserSummary {
  id: string;
  name: string;
  username: string;
  role: string;
}

export const ViewUserList = (): Task =>
  Task.where('#actor views the user list', Send.a(GetRequest.to('users')));

/** The list from the last `ViewUserList()` — call that first. */
export const TheUserList = (): QuestionAdapter<UserSummary[]> =>
  LastResponse.body<UserSummary[]>();

export const EnsureUserListWasNotDisplayed = (): Task =>
  Task.where(
    '#actor ensures the user list was not displayed',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );
