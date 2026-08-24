import { MaterialNameAlreadyExists } from '@materials/application/exceptions';
import { MaterialRepository } from '@materials/domain/service/material.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { EditMaterialCommand } from './edit-material.command';

@CommandHandler(EditMaterialCommand)
export class EditMaterialHandler implements ICommandHandler<EditMaterialCommand> {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(command: EditMaterialCommand): Promise<void> {
    const material = await this.materialRepository.get(command.materialId);

    const existingMaterial = await this.materialRepository.findByName(
      command.name,
    );
    if (existingMaterial && !existingMaterial.id.equals(material.id)) {
      throw MaterialNameAlreadyExists.withName(command.name);
    }

    material.rename(command.name);
    await this.materialRepository.save(material);
  }
}
