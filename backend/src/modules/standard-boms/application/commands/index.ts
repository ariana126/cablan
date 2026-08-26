import { DeleteStandardBomHandler } from '@standard-boms/application/commands/delete-standard-bom/delete-standard-bom.handler';
import { EditStandardBomHandler } from '@standard-boms/application/commands/edit-standard-bom/edit-standard-bom.handler';
import { RegisterStandardBomHandler } from '@standard-boms/application/commands/register-standard-bom/register-standard-bom.handler';

export const CommandHandlers = [
  RegisterStandardBomHandler,
  EditStandardBomHandler,
  DeleteStandardBomHandler,
];
