import { RecordDependencies } from '@framework/application';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteManufacturingInstructionCommand } from './delete-manufacturing-instruction.command';

@CommandHandler(DeleteManufacturingInstructionCommand)
export class DeleteManufacturingInstructionHandler implements ICommandHandler<DeleteManufacturingInstructionCommand> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: DeleteManufacturingInstructionCommand): Promise<void> {
    const manufacturingInstruction =
      await this.manufacturingInstructionRepository.get(
        command.manufacturingInstructionId,
      );
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'StandardBom',
      id: manufacturingInstruction.id.asString(),
    });
    manufacturingInstruction.delete();
    // Hard delete: nothing references the standard BOM any more, so the row
    // is removed outright rather than upserted behind a flag. Its product is
    // not deleted with it.
    await this.manufacturingInstructionRepository.delete(
      manufacturingInstruction,
    );
  }
}
