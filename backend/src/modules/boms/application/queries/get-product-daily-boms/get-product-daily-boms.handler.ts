import {
  BomDashboardRepository,
  ProductDailyBomRecord,
} from '@boms/application/service/bom-dashboard.repository';
import {
  roundWeight,
  StandardBomWeights,
  StandardWeightTable,
} from '@boms/application/service/standard-bom-weights';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetProductDailyBomsQuery } from './get-product-daily-boms.query';
import { ProductDailyBom } from './product-daily-bom.read-model';

// The per-product detail of the daily-BOM dashboard. For each daily BOM
// returned by `BomDashboardRepository`, the handler compares every material
// line with the referenced standard BOM's *current* composition through
// `StandardBomWeights` (the module's one read-side crossing into
// manufacturing-instructions for this, shared with the post-registration
// preview — see src/modules/boms/CLAUDE.md), fetching each distinct MI code
// once. The BOM's score is the sum of its lines' differences, rounded the same
// way, and the result is sorted by score desc so the dashboard can render the
// highest-deviation BOMs first.
@QueryHandler(GetProductDailyBomsQuery)
export class GetProductDailyBomsHandler implements IQueryHandler<GetProductDailyBomsQuery> {
  constructor(
    private readonly bomDashboardRepository: BomDashboardRepository,
    private readonly standardBomWeights: StandardBomWeights,
  ) {}

  async execute(query: GetProductDailyBomsQuery): Promise<ProductDailyBom[]> {
    const records = await this.bomDashboardRepository.listProductDailyBoms(
      query.productId,
      query.filters,
    );

    const tablesByMiCode = new Map<string, StandardWeightTable>();
    const scored: ProductDailyBom[] = [];
    for (const record of records) {
      let standardWeights = tablesByMiCode.get(record.standardBomMiCode);
      if (!standardWeights) {
        standardWeights = await this.standardBomWeights.ofMiCode(
          record.standardBomMiCode,
        );
        tablesByMiCode.set(record.standardBomMiCode, standardWeights);
      }
      scored.push(buildProductDailyBom(record, standardWeights));
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

function buildProductDailyBom(
  record: ProductDailyBomRecord,
  standardWeights: StandardWeightTable,
): ProductDailyBom {
  const lines = record.materials.map((material) =>
    standardWeights.differenceOf(material),
  );
  const score = lines.reduce((sum, line) => sum + line.difference, 0);

  return new ProductDailyBom(
    record.id,
    record.orderNumber,
    record.trackingNumber,
    record.registeredAt.toISOString(),
    record.registeredBy,
    record.description ?? undefined,
    record.standardBomMiCode,
    record.approvalStatus,
    record.approvedBy,
    roundWeight(score),
    lines,
  );
}
