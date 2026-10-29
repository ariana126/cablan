import { ConfirmMaterialImportHandler } from '@products/application/commands/confirm-material-import/confirm-material-import.handler';
import { DeleteComponentHandler } from '@products/application/commands/delete-component/delete-component.handler';
import { DeleteMaterialHandler } from '@products/application/commands/delete-material/delete-material.handler';
import { DeleteProductHandler } from '@products/application/commands/delete-product/delete-product.handler';
import { EditComponentHandler } from '@products/application/commands/edit-component/edit-component.handler';
import { EditMaterialHandler } from '@products/application/commands/edit-material/edit-material.handler';
import { EditProductHandler } from '@products/application/commands/edit-product/edit-product.handler';
import { RegisterComponentHandler } from '@products/application/commands/register-component/register-component.handler';
import { RegisterMaterialHandler } from '@products/application/commands/register-material/register-material.handler';
import { RegisterProductHandler } from '@products/application/commands/register-product/register-product.handler';
import { RevertMaterialImportHandler } from '@products/application/commands/revert-material-import/revert-material-import.handler';

export const CommandHandlers = [
  // materials
  RegisterMaterialHandler,
  EditMaterialHandler,
  DeleteMaterialHandler,
  ConfirmMaterialImportHandler,
  RevertMaterialImportHandler,
  // components
  RegisterComponentHandler,
  EditComponentHandler,
  DeleteComponentHandler,
  // products
  RegisterProductHandler,
  EditProductHandler,
  DeleteProductHandler,
];
