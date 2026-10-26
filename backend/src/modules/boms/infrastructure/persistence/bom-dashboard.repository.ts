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
import { Prisma } from '@prisma/client';

import { toApprovalStatus } from './approval-status.column';
import { toWhereInput } from './bom-report.repository';

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
//    over `bom` (filtered by the date range and the approval filters),
//    then a second `prisma.manufacturingInstruction.findMany` lookup to translate each
//    `(productName, standardBomId)` to a `productId`. A daily BOM does
//    **not** store `productId` directly — it stores `productName` as a
//    denormalised clone of the referenced standard BOM's `productName`,
//    and `standardBomId` as a plain (non-Prisma) reference. The standard
//    BOM, in turn, owns `productId` (a foreign key into `product`, also
//    not a Prisma relation). The two-step query keeps the join in
//    Postgres-ish land without resorting to raw SQL or a new Prisma
//    relation that would cross the module boundary at the schema level.
//    `boms/` imports nothing from `src/modules/manufacturing-instructions/` — the join
//    goes through `prisma.manufacturingInstruction` purely as a Prisma client model.
//    The productId/productName pair is stable: a standard BOM's product
//    is fixed at registration and never changes, so each `(productName,
//    standardBomId)` row in `bom` always maps to exactly one
//    `(productId, productName)` on `standard_bom`.
//
// 2. `listProductDailyBoms` does a `prisma.bom.findMany` filtered by
//    `standardBomId IN (product's standard BOMs)` and the filters, with
//    `components.materials` included. The result is reshaped to the flat
//    per-material row shape the handler joins to the standard BOM's
//    *current* composition (read separately through `StandardBomWeights`,
//    the read-side mirror of `BomCompositionFactory` — see
//    `standard-bom-weights-reuse-is-narrow` in `.dependency-cruiser.cjs`). Repository order is implementation
//    detail; the handler sorts the returned records by score desc.
//
// Filtering — the inclusive date range and the approval filters — is the
// report's own `toWhereInput` (see `toBomWhere` below): a filter absent from
// `BomDashboardFilters` means "unfiltered" and adds nothing to the `where`
// clause, so callers that pass none get the full history, not a `1970–9999`
// window. The order/tracking-number searches are ANDed on top of it. Both
// shapes apply it to `bom` itself, so the group-by's count and newest
// registration cover only the matching daily BOMs.
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
      _max: { createdAt: true },
    });

    if (rows.length === 0) {
      return [];
    }

    const standardBomIds = rows.map((row) => row.standardBomId);
    const standardBoms = await this.prisma.manufacturingInstruction.findMany({
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
      {
        productId: string;
        productName: string;
        dailyBomCount: number;
        lastRegisteredAt: Date;
      }
    >();
    for (const row of rows) {
      const product = productByStandardBomId.get(row.standardBomId);
      if (!product) {
        continue;
      }
      const key = product.productId;
      // A group always holds at least one BOM, so its newest creation time is never null.
      const lastRegisteredAt = row._max.createdAt as Date;
      const existing = grouped.get(key);
      if (existing) {
        existing.dailyBomCount += row._count._all;
        if (lastRegisteredAt > existing.lastRegisteredAt) {
          existing.lastRegisteredAt = lastRegisteredAt;
        }
      } else {
        grouped.set(key, {
          productId: product.productId,
          productName: product.productName,
          dailyBomCount: row._count._all,
          lastRegisteredAt,
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
    const standardBoms = await this.prisma.manufacturingInstruction.findMany({
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
      include: {
        components: {
          orderBy: { position: 'asc' },
          include: { materials: { orderBy: { position: 'asc' } } },
        },
      },
    });

    return boms.map((bom) => toProductDailyBomRecord(bom, productName));
  }
}

// The dashboard's filters are a subset of the report's, with the same
// semantics, so they go through the report's own translation rather than a
// copy of it: the date range as `registeredAtFrom`/`registeredAtTo`, the
// approval filters as they are (absent = unfiltered, `[]` = match nothing,
// `''` among the reviewers = `reviewed_by IS NULL`).
//
// The order/tracking-number searches are the dashboard's own and are ANDed on
// top: each trimmed text, when not blank, is a case-insensitive substring
// match (`ILIKE '%…%'` in Postgres).
function toBomWhere(filters: BomDashboardFilters): Prisma.BomWhereInput {
  const reportWhere = toWhereInput({
    registeredAtFrom: filters.from,
    registeredAtTo: filters.to,
    approvalStatuses: filters.approvalStatuses,
    reviewers: filters.reviewers,
  });

  const searches: Prisma.BomWhereInput[] = [];
  const orderNumber = filters.orderNumber?.trim();
  if (orderNumber) {
    searches.push({ orderNumber: containing(orderNumber) });
  }
  const trackingNumber = filters.trackingNumber?.trim();
  if (trackingNumber) {
    searches.push({ trackingNumber: containing(trackingNumber) });
  }

  return searches.length === 0
    ? reportWhere
    : { AND: [reportWhere, ...searches] };
}

function containing(text: string): Prisma.StringFilter {
  return { contains: text, mode: 'insensitive' };
}

function toProductDailyBomRecord(
  bom: {
    id: string;
    orderNumber: string;
    trackingNumber: string;
    createdAt: Date;
    registeredBy: string;
    description: string | null;
    standardBomMiCode: string;
    approvalStatus: string;
    reviewedBy: string | null;
    managementNote: string | null;
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
    registeredBy: bom.registeredBy,
    description: bom.description,
    standardBomMiCode: bom.standardBomMiCode,
    approvalStatus: toApprovalStatus(bom.approvalStatus),
    reviewedBy: bom.reviewedBy,
    managementNote: bom.managementNote,
    materials,
  };
}
