import { DeleteMaterialHandler } from '@materials/application/commands/delete-material/delete-material.handler';
import { EditMaterialHandler } from '@materials/application/commands/edit-material/edit-material.handler';
import { RegisterMaterialHandler } from '@materials/application/commands/register-material/register-material.handler';

export const CommandHandlers = [
  RegisterMaterialHandler,
  EditMaterialHandler,
  DeleteMaterialHandler,
];
