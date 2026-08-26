import { DeleteProductHandler } from '@products/application/commands/delete-product/delete-product.handler';
import { EditProductHandler } from '@products/application/commands/edit-product/edit-product.handler';
import { RegisterProductHandler } from '@products/application/commands/register-product/register-product.handler';

export const CommandHandlers = [
  RegisterProductHandler,
  EditProductHandler,
  DeleteProductHandler,
];
