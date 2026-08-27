import { DeleteBomHandler } from '@boms/application/commands/delete-bom/delete-bom.handler';
import { EditBomHandler } from '@boms/application/commands/edit-bom/edit-bom.handler';
import { RegisterBomHandler } from '@boms/application/commands/register-bom/register-bom.handler';

export const CommandHandlers = [
  RegisterBomHandler,
  EditBomHandler,
  DeleteBomHandler,
];
