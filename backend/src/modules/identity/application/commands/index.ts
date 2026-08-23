import { DeleteUserHandler } from '@identity/application/commands/delete-user/delete-user.handler';
import { LoginHandler } from '@identity/application/commands/login/login.handler';
import { RegisterUserHandler } from '@identity/application/commands/register-user/register-user.handler';
import { UpdateUserHandler } from '@identity/application/commands/update-user/update-user.handler';

export const CommandHandlers = [
  RegisterUserHandler,
  UpdateUserHandler,
  DeleteUserHandler,
  LoginHandler,
];
