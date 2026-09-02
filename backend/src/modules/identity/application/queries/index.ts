import { GetCurrentUserHandler } from '@identity/application/queries/get-current-user/get-current-user.handler';
import { ListUsersHandler } from '@identity/application/queries/list-users/list-users.handler';

export const QueryHandlers = [ListUsersHandler, GetCurrentUserHandler];
