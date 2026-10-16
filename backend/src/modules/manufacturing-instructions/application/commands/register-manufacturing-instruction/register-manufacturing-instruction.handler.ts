import { ManufacturingInstructionMiCodeAlreadyExists } from '@manufacturing-instructions/application/exceptions';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { ManufacturingInstructionCompositionFactory } from '@manufacturing-instructions/application/service/manufacturing-instruction-composition.factory';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { RegisterManufacturingInstructionCommand } from './register-manufacturing-instruction.command';

@CommandHandler(RegisterManufacturingInstructionCommand)
export class RegisterManufacturingInstructionHandler implements ICommandHandler<
  RegisterManufacturingInstructionCommand,
  ManufacturingInstructionReadModel
> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
    private readonly compositionFactory: ManufacturingInstructionCompositionFactory,
  ) {}

  async execute(
    command: RegisterManufacturingInstructionCommand,
  ): Promise<ManufacturingInstructionReadModel> {
    assertCompositionInvariants(command.components);

    const existingManufacturingInstruction =
      await this.manufacturingInstructionRepository.findByMiCode(
        command.miCode,
      );
    if (existingManufacturingInstruction) {
      throw ManufacturingInstructionMiCodeAlreadyExists.withMiCode(
        command.miCode,
      );
    }

    const { productName, componentLines } =
      await this.compositionFactory.buildComponentLines(
        command.productId,
        command.components,
      );
    const manufacturingInstruction = ManufacturingInstruction.register(
      command.miCode,
      command.brand,
      command.standardLength,
      command.active,
      command.description,
      command.productId,
      productName,
      componentLines,
    );
    await this.manufacturingInstructionRepository.save(
      manufacturingInstruction,
    );

    return ManufacturingInstructionReadModel.fromDomain(
      manufacturingInstruction,
    );
  }
}
