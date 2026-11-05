import { AddOrderMiCodeHandler } from '@boms/application/commands/add-order-mi-code/add-order-mi-code.handler';
import { ApproveBomHandler } from '@boms/application/commands/approve-bom/approve-bom.handler';
import { DefineOrderHandler } from '@boms/application/commands/define-order/define-order.handler';
import { DeleteBomHandler } from '@boms/application/commands/delete-bom/delete-bom.handler';
import { DeleteOrderHandler } from '@boms/application/commands/delete-order/delete-order.handler';
import { EditBomHandler } from '@boms/application/commands/edit-bom/edit-bom.handler';
import { EditOrderHandler } from '@boms/application/commands/edit-order/edit-order.handler';
import { RegisterBomHandler } from '@boms/application/commands/register-bom/register-bom.handler';
import { RejectBomHandler } from '@boms/application/commands/reject-bom/reject-bom.handler';
import { ResampleBomHandler } from '@boms/application/commands/resample-bom/resample-bom.handler';

export const CommandHandlers = [
  RegisterBomHandler,
  EditBomHandler,
  DeleteBomHandler,
  ApproveBomHandler,
  RejectBomHandler,
  ResampleBomHandler,
  // Orders (issue #101). `RegisterLegacyBomHandler` is not here: only the
  // test stack's `BomsTestingModule` provides it.
  DefineOrderHandler,
  AddOrderMiCodeHandler,
  EditOrderHandler,
  DeleteOrderHandler,
];
