import { RecordDependencies } from '@framework/application';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { classifyMaterialImport } from '@products/application/service/material-import-classification';
import { materialImportRowsFromSheet } from '@products/application/service/material-import-sheet';
import { MaterialImportSheetReader } from '@products/application/service/material-import-sheet-reader';
import { MaterialRepository } from '@products/domain/service/material.repository';

import {
  MaterialImportPreview,
  MaterialImportPreviewChange,
} from './material-import-preview.read-model';
import { PreviewMaterialImportQuery } from './preview-material-import.query';

/**
 * Reads an uploaded accounting export and lists what it would change. Stores
 * nothing: the visitor confirms by sending back the rows they kept, which
 * `ConfirmMaterialImportHandler` classifies again against the state then.
 */
@QueryHandler(PreviewMaterialImportQuery)
export class PreviewMaterialImportHandler implements IQueryHandler<PreviewMaterialImportQuery> {
  constructor(
    private readonly sheetReader: MaterialImportSheetReader,
    private readonly materialRepository: MaterialRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(
    query: PreviewMaterialImportQuery,
  ): Promise<MaterialImportPreview> {
    const cells = await this.sheetReader.readFirstSheet(query.file);
    const rows = materialImportRowsFromSheet(cells);
    const materials = await this.materialRepository.list();

    const classified = await classifyMaterialImport(
      rows,
      materials,
      this.recordDependencies,
    );

    return new MaterialImportPreview(
      classified.map(
        (item) =>
          new MaterialImportPreviewChange(
            item.row,
            item.kind,
            item.name,
            item.code,
            item.materialId,
            item.previousName,
            item.previousCode,
            item.errors,
          ),
      ),
    );
  }
}
