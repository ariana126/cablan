import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteManufacturingInstructionCommand } from './delete-manufacturing-instruction.command';

@CommandHandler(DeleteManufacturingInstructionCommand)
export class DeleteManufacturingInstructionHandler implements ICommandHandler<DeleteManufacturingInstructionCommand> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
  ) {}

  async execute(command: DeleteManufacturingInstructionCommand): Promise<void> {
    const manufacturingInstruction =
      await this.manufacturingInstructionRepository.get(
        command.manufacturingInstructionId,
      );
    manufacturingInstruction.delete();
    // Hard delete: nothing yet references a standard BOM, so the row is
    // removed outright rather than upserted behind a flag.
    await this.manufacturingInstructionRepository.delete(
      manufacturingInstruction,
    );
  }
}
