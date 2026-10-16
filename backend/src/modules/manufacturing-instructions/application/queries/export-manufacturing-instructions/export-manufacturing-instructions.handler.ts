import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ExportManufacturingInstructionsQuery } from './export-manufacturing-instructions.query';
import {
  ManufacturingInstructionExportComponent,
  ManufacturingInstructionExportItem,
  ManufacturingInstructionExportMaterial,
  ManufacturingInstructionExportResult,
} from './manufacturing-instruction-export.read-model';

@QueryHandler(ExportManufacturingInstructionsQuery)
export class ExportManufacturingInstructionsHandler implements IQueryHandler<ExportManufacturingInstructionsQuery> {
  constructor(
    private readonly manufacturingInstructionReportRepository: ManufacturingInstructionReportRepository,
  ) {}

  async execute(
    query: ExportManufacturingInstructionsQuery,
  ): Promise<ManufacturingInstructionExportResult> {
    const records =
      await this.manufacturingInstructionReportRepository.exportRecords(
        query.filters,
      );

    return new ManufacturingInstructionExportResult(
      records.map(
        (record) =>
          new ManufacturingInstructionExportItem(
            record.miCode,
            record.brand,
            record.standardLength,
            record.active,
            record.productName,
            record.description,
            record.components.map(
              (component) =>
                new ManufacturingInstructionExportComponent(
                  component.name,
                  component.materials.map(
                    (material) =>
                      new ManufacturingInstructionExportMaterial(
                        material.name,
                        material.weight,
                      ),
                  ),
                ),
            ),
          ),
      ),
    );
  }
}
