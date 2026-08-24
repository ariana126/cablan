import { MaterialRepository } from '@materials/domain/service/material.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteMaterialCommand } from './delete-material.command';

@CommandHandler(DeleteMaterialCommand)
export class DeleteMaterialHandler implements ICommandHandler<DeleteMaterialCommand> {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(command: DeleteMaterialCommand): Promise<void> {
    const material = await this.materialRepository.get(command.materialId);
    material.delete();
    // Hard delete: unlike User, nothing yet references a material, so the
    // row is removed outright rather than upserted behind a flag.
    await this.materialRepository.delete(material);
  }
}
