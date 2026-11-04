import { RecordDependencies, UnitOfWork } from '@framework/application';
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
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EditMaterialCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const material = await this.materialRepository.get(command.materialId);
      // A record another record references can be neither edited nor
      // deleted (issue #94) — unless it is the System Admin's correction
      // (issue #110) of its name and code, carried into every related record.
      await this.recordDependencies.editRecordInUse(
        { type: 'Material', id: material.id.asString() },
        {
          applyToRelatedRecords: command.applyToRelatedRecords,
          changesOnlyCorrectableFields: material.changesOnlyCorrectableFields(),
          before: {
            name: material.name().asString(),
            code: material.code().asString(),
          },
          after: {
            name: command.name.asString(),
            code: command.code.asString(),
          },
        },
        async () => {
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
        },
      );
    });
  }
}
