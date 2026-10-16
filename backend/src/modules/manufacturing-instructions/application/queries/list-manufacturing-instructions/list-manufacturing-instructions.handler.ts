import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListManufacturingInstructionsQuery } from './list-manufacturing-instructions.query';
import { ManufacturingInstructionReadModel } from './manufacturing-instruction.read-model';

@QueryHandler(ListManufacturingInstructionsQuery)
export class ListManufacturingInstructionsHandler implements IQueryHandler<ListManufacturingInstructionsQuery> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
  ) {}

  async execute(): Promise<ManufacturingInstructionReadModel[]> {
    const manufacturingInstructions =
      await this.manufacturingInstructionRepository.list();
    return manufacturingInstructions.map((manufacturingInstruction) =>
      ManufacturingInstructionReadModel.fromDomain(manufacturingInstruction),
    );
  }
}
