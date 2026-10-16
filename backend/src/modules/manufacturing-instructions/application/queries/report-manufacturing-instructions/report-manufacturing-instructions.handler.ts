import { ManufacturingInstructionReportRepository } from '@manufacturing-instructions/application/service/manufacturing-instruction-report.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ManufacturingInstructionReportItem,
  ManufacturingInstructionReportPage,
} from './manufacturing-instruction-report.read-model';
import { ReportManufacturingInstructionsQuery } from './report-manufacturing-instructions.query';

@QueryHandler(ReportManufacturingInstructionsQuery)
export class ReportManufacturingInstructionsHandler implements IQueryHandler<ReportManufacturingInstructionsQuery> {
  constructor(
    private readonly manufacturingInstructionReportRepository: ManufacturingInstructionReportRepository,
  ) {}

  async execute(
    query: ReportManufacturingInstructionsQuery,
  ): Promise<ManufacturingInstructionReportPage> {
    const result = await this.manufacturingInstructionReportRepository.search({
      page: query.page,
      pageSize: query.pageSize,
      filters: {
        brands: query.brands,
        activeStatuses: query.activeStatuses,
        productNames: query.productNames,
        componentNames: query.componentNames,
        miCodes: query.miCodes,
      },
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });

    return new ManufacturingInstructionReportPage(
      result.items.map(
        (item) =>
          new ManufacturingInstructionReportItem(
            item.id,
            item.miCode,
            item.brand,
            item.productName,
            item.active,
          ),
      ),
      result.total,
    );
  }
}
