import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StandardBomReportRepository } from '@standard-boms/application/service/standard-bom-report.repository';

import { ExportStandardBomsQuery } from './export-standard-boms.query';
import {
  StandardBomExportComponent,
  StandardBomExportItem,
  StandardBomExportMaterial,
  StandardBomExportResult,
} from './standard-bom-export.read-model';

@QueryHandler(ExportStandardBomsQuery)
export class ExportStandardBomsHandler implements IQueryHandler<ExportStandardBomsQuery> {
  constructor(
    private readonly standardBomReportRepository: StandardBomReportRepository,
  ) {}

  async execute(
    query: ExportStandardBomsQuery,
  ): Promise<StandardBomExportResult> {
    const records = await this.standardBomReportRepository.exportRecords(
      query.filters,
    );

    return new StandardBomExportResult(
      records.map(
        (record) =>
          new StandardBomExportItem(
            record.miCode,
            record.brand,
            record.standardLength,
            record.active,
            record.productName,
            record.description,
            record.components.map(
              (component) =>
                new StandardBomExportComponent(
                  component.name,
                  component.materials.map(
                    (material) =>
                      new StandardBomExportMaterial(
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
