import { BomDashboardRepository } from '@boms/application/service/bom-dashboard.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ListDashboardProductsQuery } from './list-dashboard-products.query';
import { ProductDashboardSummary } from './product-dashboard-summary.read-model';

// The list of products-with-daily-BOMs that drives the dashboard's outer
// table. The repository already returns the records in productName-asc
// order (the only order the dashboard supports), so the handler's job is
// a 1:1 mapping, with no sort, no pagination and no other work.
@QueryHandler(ListDashboardProductsQuery)
export class ListDashboardProductsHandler implements IQueryHandler<ListDashboardProductsQuery> {
  constructor(
    private readonly bomDashboardRepository: BomDashboardRepository,
  ) {}

  async execute(
    query: ListDashboardProductsQuery,
  ): Promise<ProductDashboardSummary[]> {
    const records = await this.bomDashboardRepository.listDashboardProducts({
      from: query.from,
      to: query.to,
    });
    return records.map(
      (record) =>
        new ProductDashboardSummary(
          record.productId,
          record.productName,
          record.dailyBomCount,
        ),
    );
  }
}
