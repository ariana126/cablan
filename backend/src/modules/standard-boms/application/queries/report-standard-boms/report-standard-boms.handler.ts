import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StandardBomReportRepository } from '@standard-boms/application/service/standard-bom-report.repository';

import { ReportStandardBomsQuery } from './report-standard-boms.query';
import {
  StandardBomReportItem,
  StandardBomReportPage,
} from './standard-bom-report.read-model';

@QueryHandler(ReportStandardBomsQuery)
export class ReportStandardBomsHandler implements IQueryHandler<ReportStandardBomsQuery> {
  constructor(
    private readonly standardBomReportRepository: StandardBomReportRepository,
  ) {}

  async execute(
    query: ReportStandardBomsQuery,
  ): Promise<StandardBomReportPage> {
    const result = await this.standardBomReportRepository.search({
      page: query.page,
      pageSize: query.pageSize,
      filters: {
        brands: query.brands,
        activeStatuses: query.activeStatuses,
        productNames: query.productNames,
        componentNames: query.componentNames,
      },
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });

    return new StandardBomReportPage(
      result.items.map(
        (item) =>
          new StandardBomReportItem(
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
