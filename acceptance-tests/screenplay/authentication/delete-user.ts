import { d, Task } from '@serenity-js/core';
import {
  containAtLeastOneItemThat,
  Ensure,
  equals,
  isGreaterThan,
  isLessThan,
  not,
  property,
} from '@serenity-js/assertions';
import { DeleteRequest, LastResponse, Send } from '@serenity-js/rest';
import { theLastRegisteredUser } from './user-details';
import { TheUserList, ViewUserList } from './view-user-list';

export const DeleteUser = {
  viaApiUsing: (id: string): Task =>
    Task.where(
      d`#actor deletes user ${id}`,
      Send.a(DeleteRequest.to(`users/${id}`)),
    ),
};

export const EnsureUserWasDeleted = (): Task => {
  const target = theLastRegisteredUser();
  return Task.where(
    d`#actor ensures ${target.username} was deleted`,
    Ensure.that(LastResponse.status(), isLessThan(300)),
    ViewUserList(),
    Ensure.that(
      TheUserList(),
      not(containAtLeastOneItemThat(property('id', equals(target.id)))),
    ),
  );
};

export const EnsureUserWasNotDeleted = (): Task =>
  Task.where(
    '#actor ensures the user was not deleted',
    Ensure.that(LastResponse.status(), isGreaterThan(399)),
  );
