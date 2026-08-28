import { BomReportRepository } from '@boms/application/service/bom-report.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { BomReportItem, BomReportPage } from './bom-report.read-model';
import { ReportBomsQuery } from './report-boms.query';

@QueryHandler(ReportBomsQuery)
export class ReportBomsHandler implements IQueryHandler<ReportBomsQuery> {
  constructor(private readonly bomReportRepository: BomReportRepository) {}

  async execute(query: ReportBomsQuery): Promise<BomReportPage> {
    const result = await this.bomReportRepository.search({
      page: query.page,
      pageSize: query.pageSize,
      filters: query.filters,
    });

    return new BomReportPage(
      result.items.map(
        (item) =>
          new BomReportItem(
            item.id,
            item.orderNumber,
            item.trackingNumber,
            item.registeredAt.toISOString(),
            item.registeredBy,
            item.standardBomMiCode,
            item.brand,
            item.productName,
          ),
      ),
      result.total,
    );
  }
}
