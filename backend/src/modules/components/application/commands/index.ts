import { DeleteComponentHandler } from '@components/application/commands/delete-component/delete-component.handler';
import { EditComponentHandler } from '@components/application/commands/edit-component/edit-component.handler';
import { RegisterComponentHandler } from '@components/application/commands/register-component/register-component.handler';

export const CommandHandlers = [
  RegisterComponentHandler,
  EditComponentHandler,
  DeleteComponentHandler,
];
