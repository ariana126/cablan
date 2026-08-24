import { MaterialNameAlreadyExists } from '@materials/application/exceptions';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialRepository } from '@materials/domain/service/material.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterMaterialCommand } from './register-material.command';

@CommandHandler(RegisterMaterialCommand)
export class RegisterMaterialHandler implements ICommandHandler<
  RegisterMaterialCommand,
  { id: string }
> {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(command: RegisterMaterialCommand): Promise<{ id: string }> {
    const existingMaterial = await this.materialRepository.findByName(
      command.name,
    );
    if (existingMaterial) {
      throw MaterialNameAlreadyExists.withName(command.name);
    }

    const material = Material.register(command.name);
    await this.materialRepository.save(material);

    return { id: material.id.asString() };
  }
}
