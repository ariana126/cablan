import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  MaterialCodeAlreadyExists,
  MaterialNameAlreadyExists,
} from '@products/application/exceptions';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';

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

    const materialWithCode = await this.materialRepository.findByCode(
      command.code,
    );
    if (materialWithCode) {
      throw MaterialCodeAlreadyExists.withCode(command.code);
    }

    const material = Material.register(command.name, command.code);
    await this.materialRepository.save(material);

    return { id: material.id.asString() };
  }
}
