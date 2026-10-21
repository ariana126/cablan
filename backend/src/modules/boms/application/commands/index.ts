import { ApproveBomHandler } from '@boms/application/commands/approve-bom/approve-bom.handler';
import { DeleteBomHandler } from '@boms/application/commands/delete-bom/delete-bom.handler';
import { EditBomHandler } from '@boms/application/commands/edit-bom/edit-bom.handler';
import { RegisterBomHandler } from '@boms/application/commands/register-bom/register-bom.handler';
import { RevokeBomApprovalHandler } from '@boms/application/commands/revoke-bom-approval/revoke-bom-approval.handler';

export const CommandHandlers = [
  RegisterBomHandler,
  EditBomHandler,
  DeleteBomHandler,
  ApproveBomHandler,
  RevokeBomApprovalHandler,
];
