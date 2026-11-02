import { RecordDependencies, UnitOfWork } from '@framework/application';
import { Clock } from '@framework/domain';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  MaterialImportEmpty,
  MaterialImportHasInvalidRows,
} from '@products/application/exceptions';
import { classifyMaterialImport } from '@products/application/service/material-import-classification';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialImportRepository } from '@products/domain/service/material-import.repository';
import { applyMaterialImport } from '@products/domain/service/material-import-application';
import { isMaterialImportChangeKind } from '@products/domain/value/material-import-change.vo';

import { MATERIAL_IMPORT_LOCK } from '../material-import-lock';
import { ConfirmMaterialImportCommand } from './confirm-material-import.command';

/**
 * Applies the rows a visitor kept from an import's change list — all of
 * them or none (issue #74). The rows are classified again against the
 * materials as they stand now, never trusted from the preview — and, inside
 * the import lock, against which of them other records reference (a row
 * revising one is `material-in-use`, issue #94): any row with an error
 * refuses the whole import, and an import that changes nothing is
 * refused too. `applyMaterialImport` turns the rest into material changes and
 * the `MaterialImport` record; every change, the record and its one audit
 * entry are written in one unit of work, serialised with every other import
 * and reversion.
 */
@CommandHandler(ConfirmMaterialImportCommand)
export class ConfirmMaterialImportHandler implements ICommandHandler<
  ConfirmMaterialImportCommand,
  { id: string }
> {
  constructor(
    private readonly materialRepository: MaterialRepository,
    private readonly materialImportRepository: MaterialImportRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  execute(command: ConfirmMaterialImportCommand): Promise<{ id: string }> {
    return this.unitOfWork.runExclusively(MATERIAL_IMPORT_LOCK, async () => {
      const materials = await this.materialRepository.list();
      const classified = await classifyMaterialImport(
        command.rows,
        materials,
        this.recordDependencies,
      );

      const invalid = classified.filter((item) => item.errors.length > 0);
      if (invalid.length > 0) {
        throw MaterialImportHasInvalidRows.withRows(
          invalid.map(({ row, name, code, errors }) => ({
            row,
            name,
            code,
            errors,
          })),
        );
      }
      const effective = classified.filter((item) =>
        isMaterialImportChangeKind(item.kind),
      );
      if (effective.length === 0) {
        throw MaterialImportEmpty.create();
      }

      const { touchedMaterials, materialImport } = applyMaterialImport(
        effective,
        materials,
        this.clock.now(),
      );
      for (const material of touchedMaterials) {
        await this.materialRepository.save(material);
      }
      await this.materialImportRepository.save(materialImport);
      return { id: materialImport.id.asString() };
    });
  }
}
