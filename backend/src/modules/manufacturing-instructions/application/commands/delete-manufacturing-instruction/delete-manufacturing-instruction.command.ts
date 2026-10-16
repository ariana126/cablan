import { Identity } from '@framework/domain';

export class DeleteManufacturingInstructionCommand {
  constructor(public readonly manufacturingInstructionId: Identity) {}
}
