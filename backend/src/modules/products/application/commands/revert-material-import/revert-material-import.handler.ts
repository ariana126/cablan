import { UnitOfWork } from '@framework/application';
import { Clock } from '@framework/domain';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MaterialImportNotFound } from '@products/application/exceptions';
import { MaterialImportRepository } from '@products/domain/service/material-import.repository';
import { MaterialImportReversion } from '@products/domain/service/material-import-reversion';

import { MATERIAL_IMPORT_LOCK } from '../material-import-lock';
import { RevertMaterialImportCommand } from './revert-material-import.command';

/**
 * Reverts a bulk import (issue #74). `MaterialImportReversion` decides
 * whether it still can be and undoes its changes; this runs that in one unit
 * of work, serialised with every other import and reversion, and saves the
 * import — whose save writes the `Reverted` audit entry in the same
 * transaction.
 */
@CommandHandler(RevertMaterialImportCommand)
export class RevertMaterialImportHandler implements ICommandHandler<RevertMaterialImportCommand> {
  constructor(
    private readonly materialImportRepository: MaterialImportRepository,
    private readonly reversion: MaterialImportReversion,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(command: RevertMaterialImportCommand): Promise<void> {
    return this.unitOfWork.runExclusively(MATERIAL_IMPORT_LOCK, async () => {
      const materialImport = await this.materialImportRepository.find(
        command.importId,
      );
      if (!materialImport) {
        throw MaterialImportNotFound.withId(command.importId);
      }
      await this.reversion.revert(materialImport, this.clock.now());
      await this.materialImportRepository.save(materialImport);
    });
  }
}
