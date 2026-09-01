import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  BomExportComponent,
  BomExportItem,
  BomExportMaterial,
  BomExportResult,
} from './bom-export.read-model';
import { ExportBomsQuery } from './export-boms.query';

@QueryHandler(ExportBomsQuery)
export class ExportBomsHandler implements IQueryHandler<ExportBomsQuery> {
  constructor(private readonly bomReportRepository: BomReportRepository) {}

  async execute(query: ExportBomsQuery): Promise<BomExportResult> {
    const records = await this.bomReportRepository.exportRecords(query.filters);

    return new BomExportResult(
      records.map(
        (record) =>
          new BomExportItem(
            record.orderNumber,
            record.trackingNumber,
            record.registeredAt.toISOString(),
            record.registeredBy,
            record.standardBomMiCode,
            record.brand,
            record.standardLength,
            record.productName,
            record.description,
            record.components.map(
              (component) =>
                new BomExportComponent(
                  component.name,
                  component.materials.map(
                    (material) =>
                      new BomExportMaterial(material.name, material.weight),
                  ),
                ),
            ),
          ),
      ),
    );
  }
}
