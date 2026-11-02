import { RecordDependencies } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  MaterialCodeAlreadyExists,
  MaterialNameAlreadyExists,
} from '@products/application/exceptions';
import { MaterialRepository } from '@products/domain/service/material.repository';

import { EditMaterialCommand } from './edit-material.command';

@CommandHandler(EditMaterialCommand)
export class EditMaterialHandler implements ICommandHandler<EditMaterialCommand> {
  constructor(
    private readonly materialRepository: MaterialRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: EditMaterialCommand): Promise<void> {
    const material = await this.materialRepository.get(command.materialId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Material',
      id: material.id.asString(),
    });

    const existingMaterial = await this.materialRepository.findByName(
      command.name,
    );
    if (existingMaterial && !existingMaterial.id.equals(material.id)) {
      throw MaterialNameAlreadyExists.withName(command.name);
    }

    const materialWithCode = await this.materialRepository.findByCode(
      command.code,
    );
    if (materialWithCode && !materialWithCode.id.equals(material.id)) {
      throw MaterialCodeAlreadyExists.withCode(command.code);
    }

    material.edit({ name: command.name, code: command.code });
    await this.materialRepository.save(material);
  }
}
