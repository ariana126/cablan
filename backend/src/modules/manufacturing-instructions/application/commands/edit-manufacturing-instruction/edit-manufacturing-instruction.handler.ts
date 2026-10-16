import { ManufacturingInstructionMiCodeAlreadyExists } from '@manufacturing-instructions/application/exceptions';
import { ManufacturingInstructionCompositionFactory } from '@manufacturing-instructions/application/service/manufacturing-instruction-composition.factory';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { EditManufacturingInstructionCommand } from './edit-manufacturing-instruction.command';

@CommandHandler(EditManufacturingInstructionCommand)
export class EditManufacturingInstructionHandler implements ICommandHandler<EditManufacturingInstructionCommand> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
    private readonly compositionFactory: ManufacturingInstructionCompositionFactory,
  ) {}

  async execute(command: EditManufacturingInstructionCommand): Promise<void> {
    const manufacturingInstruction =
      await this.manufacturingInstructionRepository.get(
        command.manufacturingInstructionId,
      );

    const miCode = command.miCode ?? manufacturingInstruction.miCode();
    const brand = command.brand ?? manufacturingInstruction.brand();
    const standardLength =
      command.standardLength ?? manufacturingInstruction.standardLength();
    const description =
      command.description === undefined
        ? manufacturingInstruction.description()
        : command.description;
    const active = command.active ?? manufacturingInstruction.active();

    const conflictingManufacturingInstruction =
      await this.manufacturingInstructionRepository.findByMiCode(miCode);
    if (
      conflictingManufacturingInstruction &&
      !conflictingManufacturingInstruction.id.equals(
        manufacturingInstruction.id,
      )
    ) {
      throw ManufacturingInstructionMiCodeAlreadyExists.withMiCode(miCode);
    }

    let componentLines: ManufacturingInstructionComponentLine[] | undefined;
    if (command.components !== undefined) {
      assertCompositionInvariants(command.components);
      ({ componentLines } = await this.compositionFactory.buildComponentLines(
        manufacturingInstruction.productId(),
        command.components,
      ));
    }

    manufacturingInstruction.edit(
      miCode,
      brand,
      standardLength,
      description,
      active,
      componentLines,
    );

    await this.manufacturingInstructionRepository.save(
      manufacturingInstruction,
    );
  }
}
