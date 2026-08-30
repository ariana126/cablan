import { BomDashboardRepository } from '@boms/application/service/bom-dashboard.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { QueryBus } from '@nestjs/cqrs';
import { GetStandardBomDetailQuery } from '@standard-boms/application/queries/get-standard-bom-detail/get-standard-bom-detail.query';
import { StandardBomDetail } from '@standard-boms/application/queries/get-standard-bom-detail/standard-bom-detail.read-model';

import { GetProductDailyBomsQuery } from './get-product-daily-boms.query';
import {
  ProductDailyBom,
  ProductDailyBomLine,
} from './product-daily-bom.read-model';

// The per-product detail of the daily-BOM dashboard. For each daily BOM
// returned by `BomDashboardRepository`, the handler also needs the
// referenced standard BOM's *current* composition to compute the
// "deviation from standard" score (Σ |actualWeight - standardWeight|
// across every material line) — read through
// `GetStandardBomDetailQuery` on the `QueryBus`, the same read-side
// crossing `BomCompositionFactory` already uses for a different purpose
// (see src/modules/boms/CLAUDE.md and the narrow `.dependency-cruiser.cjs`
// exception this relies on). The result is sorted by score desc so the
// dashboard can render the highest-deviation BOMs first.
//
// A material line on a daily BOM that no longer exists on the standard
// BOM's current composition (the standard BOM was edited after the daily
// BOM was registered) is scored against `standardWeight: 0` rather than
// skipped — the whole reason this dashboard exists is to surface exactly
// those drifts, and dropping the line would silently understate the
// score. The `(componentId, materialId)` pair is what joins, mirroring
// how `BomCompositionFactory` looks the pair up at registration time.
@QueryHandler(GetProductDailyBomsQuery)
export class GetProductDailyBomsHandler implements IQueryHandler<GetProductDailyBomsQuery> {
  constructor(
    private readonly bomDashboardRepository: BomDashboardRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(query: GetProductDailyBomsQuery): Promise<ProductDailyBom[]> {
    const records = await this.bomDashboardRepository.listProductDailyBoms(
      query.productId,
      { from: query.from, to: query.to },
    );

    const standardWeightsByMiCode = new Map<string, Map<string, number>>();
    for (const record of records) {
      if (!standardWeightsByMiCode.has(record.standardBomMiCode)) {
        const standardBom = await this.queryBus.execute<
          GetStandardBomDetailQuery,
          StandardBomDetail
        >(new GetStandardBomDetailQuery(record.standardBomMiCode));
        standardWeightsByMiCode.set(
          record.standardBomMiCode,
          indexStandardWeights(standardBom),
        );
      }
    }

    const scored = records.map((record) =>
      buildProductDailyBom(
        record,
        standardWeightsByMiCode.get(record.standardBomMiCode) ??
          new Map<string, number>(),
      ),
    );
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

function indexStandardWeights(
  standardBom: StandardBomDetail,
): Map<string, number> {
  const byKey = new Map<string, number>();
  for (const component of standardBom.components) {
    for (const material of component.materials) {
      byKey.set(
        weightKey(component.componentId, material.materialId),
        material.weight,
      );
    }
  }
  return byKey;
}

function weightKey(componentId: string, materialId: string): string {
  return `${componentId}::${materialId}`;
}

function buildProductDailyBom(
  record: {
    id: string;
    orderNumber: string;
    registeredAt: Date;
    description: string | null;
    materials: {
      componentId: string;
      componentName: string;
      materialId: string;
      materialName: string;
      actualWeight: number;
    }[];
  },
  standardWeights: Map<string, number>,
): ProductDailyBom {
  let score = 0;
  const lines: ProductDailyBomLine[] = record.materials.map((material) => {
    const standardWeight =
      standardWeights.get(
        weightKey(material.componentId, material.materialId),
      ) ?? 0;
    score += Math.abs(material.actualWeight - standardWeight);
    return new ProductDailyBomLine(
      material.componentName,
      material.materialName,
      material.actualWeight,
      standardWeight,
    );
  });

  return new ProductDailyBom(
    record.id,
    record.orderNumber,
    record.registeredAt.toISOString(),
    record.description ?? undefined,
    score,
    lines,
  );
}
