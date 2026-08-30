import {
  BomDashboardFilters,
  BomDashboardRepository,
  ProductDailyBomMaterialRecord,
  ProductDailyBomRecord,
  ProductDashboardSummaryRecord,
} from '@boms/application/service/bom-dashboard.repository';
import { Identity } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';

// The read-side counterpart to `PrismaBomReportRepository`/`PrismaBomRepository`,
// behind the daily-BOM dashboard queries (`ListDashboardProductsHandler` and
// `GetProductDailyBomsHandler`). Mirrors `PrismaBomReportRepository`'s
// shape and purpose: bypasses `BomMapper`/`Bom.fromPersistence()` and
// queries the underlying tables directly for a projected, filtered shape
// rather than loading the full `Bom` aggregate and slicing it in memory.
// The dashboard is the second genuinely projected/filtered read in this
// module, hence the second dedicated read-side port (see
// src/modules/boms/CLAUDE.md).
//
// Two query shapes here, both pushed into SQL:
//
// 1. `listDashboardProducts` does a `GROUP BY (productName, standardBomId)`
//    over `bom` (filtered by the `from`/`to` range against `createdAt`),
//    then a second `prisma.standardBom.findMany` lookup to translate each
//    `(productName, standardBomId)` to a `productId`. A daily BOM does
//    **not** store `productId` directly — it stores `productName` as a
//    denormalised clone of the referenced standard BOM's `productName`,
//    and `standardBomId` as a plain (non-Prisma) reference. The standard
//    BOM, in turn, owns `productId` (a foreign key into `product`, also
//    not a Prisma relation). The two-step query keeps the join in
//    Postgres-ish land without resorting to raw SQL or a new Prisma
//    relation that would cross the module boundary at the schema level.
//    `boms/` imports nothing from `src/modules/standard-boms/` — the join
//    goes through `prisma.standardBom` purely as a Prisma client model.
//    The productId/productName pair is stable: a standard BOM's product
//    is fixed at registration and never changes, so each `(productName,
//    standardBomId)` row in `bom` always maps to exactly one
//    `(productId, productName)` on `standard_bom`.
//
// 2. `listProductDailyBoms` does a `prisma.bom.findMany` filtered by
//    `standardBomId IN (product's standard BOMs)` and the date range, with
//    `components.materials` included. The result is reshaped to the flat
//    per-material row shape the handler joins to the standard BOM's
//    *current* composition (read separately on the `QueryBus` via
//    `GetStandardBomDetailQuery`, the read-side mirror of
//    `BomCompositionFactory` — see `bom-dashboard-handler-reuse-is-narrow`
//    in `.dependency-cruiser.cjs`). Repository order is implementation
//    detail; the handler sorts the returned records by score desc.
//
// Date range filtering is the same inclusive-on-both-ends convention
// `PrismaBomReportRepository.toWhereInput` already uses: a `from`/`to`
// pair absent from `BomDashboardFilters` means "unfiltered" — the bound
// is only added to the `where` clause when present, so callers that pass
// neither get the full history, not a `1970–9999` window.
@Injectable()
export class PrismaBomDashboardRepository implements BomDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDashboardProducts(
    filters: BomDashboardFilters,
  ): Promise<ProductDashboardSummaryRecord[]> {
    const rows = await this.prisma.bom.groupBy({
      by: ['productName', 'standardBomId'],
      where: toBomWhere(filters),
      _count: { _all: true },
    });

    if (rows.length === 0) {
      return [];
    }

    const standardBomIds = rows.map((row) => row.standardBomId);
    const standardBoms = await this.prisma.standardBom.findMany({
      where: { id: { in: standardBomIds } },
      select: { id: true, productId: true, productName: true },
    });

    const productByStandardBomId = new Map<
      string,
      { productId: string; productName: string }
    >();
    for (const standardBom of standardBoms) {
      productByStandardBomId.set(standardBom.id, {
        productId: standardBom.productId,
        productName: standardBom.productName,
      });
    }

    const grouped = new Map<
      string,
      { productId: string; productName: string; dailyBomCount: number }
    >();
    for (const row of rows) {
      const product = productByStandardBomId.get(row.standardBomId);
      if (!product) {
        continue;
      }
      const key = product.productId;
      const existing = grouped.get(key);
      if (existing) {
        existing.dailyBomCount += row._count._all;
      } else {
        grouped.set(key, {
          productId: product.productId,
          productName: product.productName,
          dailyBomCount: row._count._all,
        });
      }
    }

    return [...grouped.values()].toSorted((a, b) =>
      a.productName.localeCompare(b.productName),
    );
  }

  async listProductDailyBoms(
    productId: Identity,
    filters: BomDashboardFilters,
  ): Promise<ProductDailyBomRecord[]> {
    const standardBoms = await this.prisma.standardBom.findMany({
      where: { productId: productId.asString() },
      select: { id: true, productName: true },
    });

    if (standardBoms.length === 0) {
      return [];
    }

    const productName = standardBoms[0].productName;
    const standardBomIds = standardBoms.map((row) => row.id);

    const boms = await this.prisma.bom.findMany({
      where: {
        standardBomId: { in: standardBomIds },
        ...toBomWhere(filters),
      },
      include: { components: { include: { materials: true } } },
    });

    return boms.map((bom) => toProductDailyBomRecord(bom, productName));
  }
}

function toBomWhere(filters: BomDashboardFilters) {
  if (filters.from === undefined && filters.to === undefined) {
    return {};
  }
  return {
    createdAt: {
      ...(filters.from === undefined ? {} : { gte: filters.from }),
      ...(filters.to === undefined ? {} : { lte: filters.to }),
    },
  };
}

function toProductDailyBomRecord(
  bom: {
    id: string;
    orderNumber: string;
    trackingNumber: string;
    createdAt: Date;
    description: string | null;
    standardBomMiCode: string;
    components: Array<{
      componentId: string;
      name: string;
      materials: Array<{
        materialId: string;
        name: string;
        weight: number;
      }>;
    }>;
  },
  // Verified above by the standard_bom join: every component row cloned
  // into this BOM at registration carried the same `productName` the
  // standard BOM already stored (the `BomCompositionFactory` clones
  // `productName` once and only once at the BOM's own registration), so a
  // single canonical value is what every per-material row needs.
  _productName: string,
): ProductDailyBomRecord {
  const materials: ProductDailyBomMaterialRecord[] = [];
  for (const component of bom.components) {
    for (const material of component.materials) {
      materials.push({
        componentId: component.componentId,
        componentName: component.name,
        materialId: material.materialId,
        materialName: material.name,
        actualWeight: material.weight,
      });
    }
  }

  return {
    id: bom.id,
    orderNumber: bom.orderNumber,
    trackingNumber: bom.trackingNumber,
    registeredAt: bom.createdAt,
    description: bom.description,
    standardBomMiCode: bom.standardBomMiCode,
    materials,
  };
}
