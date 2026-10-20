import { BomDashboardRepository } from '@boms/application/service/bom-dashboard.repository';
import { GetManufacturingInstructionDetailQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/get-manufacturing-instruction-detail.query';
import { ManufacturingInstructionDetail } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-detail/manufacturing-instruction-detail.read-model';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { QueryBus } from '@nestjs/cqrs';

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
// `GetManufacturingInstructionDetailQuery` on the `QueryBus`, the same read-side
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
//
// Each line also carries its `difference`, the absolute deviation
// |actualWeight - standardWeight| — a line 2 under the standard is exactly as
// far out of standard as one 2 over — and the score is the sum of the lines'
// differences. Weights are IEEE-754 doubles, so a bare subtraction leaks
// float noise onto the wire (6.3 - 6.1 = 0.20000000000000018); both the
// difference and the score are rounded to `WEIGHT_DECIMALS` places — far
// finer than any weight a person enters in grams, far coarser than the
// noise.
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
          GetManufacturingInstructionDetailQuery,
          ManufacturingInstructionDetail
        >(new GetManufacturingInstructionDetailQuery(record.standardBomMiCode));
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
  standardBom: ManufacturingInstructionDetail,
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

const WEIGHT_DECIMALS = 6;
const WEIGHT_SCALE = 10 ** WEIGHT_DECIMALS;

function roundWeight(grams: number): number {
  return Math.round(grams * WEIGHT_SCALE) / WEIGHT_SCALE;
}

function weightKey(componentId: string, materialId: string): string {
  return `${componentId}::${materialId}`;
}

function buildProductDailyBom(
  record: {
    id: string;
    orderNumber: string;
    trackingNumber: string;
    registeredAt: Date;
    registeredBy: string;
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
    const difference = roundWeight(
      Math.abs(material.actualWeight - standardWeight),
    );
    score += difference;
    return new ProductDailyBomLine(
      material.componentName,
      material.materialName,
      material.actualWeight,
      standardWeight,
      difference,
    );
  });

  return new ProductDailyBom(
    record.id,
    record.orderNumber,
    record.trackingNumber,
    record.registeredAt.toISOString(),
    record.registeredBy,
    record.description ?? undefined,
    roundWeight(score),
    lines,
  );
}
