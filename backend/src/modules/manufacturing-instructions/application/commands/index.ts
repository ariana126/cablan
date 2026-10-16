import { DeleteManufacturingInstructionHandler } from '@manufacturing-instructions/application/commands/delete-manufacturing-instruction/delete-manufacturing-instruction.handler';
import { EditManufacturingInstructionHandler } from '@manufacturing-instructions/application/commands/edit-manufacturing-instruction/edit-manufacturing-instruction.handler';
import { RegisterManufacturingInstructionHandler } from '@manufacturing-instructions/application/commands/register-manufacturing-instruction/register-manufacturing-instruction.handler';

export const CommandHandlers = [
  RegisterManufacturingInstructionHandler,
  EditManufacturingInstructionHandler,
  DeleteManufacturingInstructionHandler,
];
