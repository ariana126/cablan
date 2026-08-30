import { Identity } from '@framework/domain';

// The read-side port behind the daily-BOM dashboard queries (the two
// `ListDashboardProductsQuery` / `GetProductDailyBomsQuery` handlers in
// `application/queries/`). Mirrors `BomReportRepository`'s shape and
// purpose: a separate port from `BomRepository`/`BomReportRepository`
// because the dashboard is yet another genuinely projected, filtered read
// (product-grouped counts and score-sorted, weight-joined rows) that pushes
// `WHERE`/`ORDER BY` into the database rather than loading full aggregates
// and slicing in memory. The Prisma implementation, like
// `PrismaBomReportRepository`'s, bypasses `BomMapper`/`Bom.fromPersistence()`
// entirely and queries `prisma.bom`/`prisma.bomComponent` directly for a
// projected shape.
//
// As on `BomReportFilters`, a date bound absent means "unfiltered". Both
// bounds are inclusive on both ends, matching `BomReportFilters`'s
// `registeredAtFrom`/`registeredAtTo` convention. Neither bound is added to
// the query at all when the caller's `from`/`to` is `undefined` — a
// separate "from 1970 to 9999" pair would change the empty-set semantics in
// subtle ways the rest of the reporting layer never agreed on.
export interface BomDashboardFilters {
  readonly from?: Date;
  readonly to?: Date;
}

export interface ProductDashboardSummaryRecord {
  readonly productId: string;
  readonly productName: string;
  readonly dailyBomCount: number;
}

export interface ProductDailyBomMaterialRecord {
  readonly componentId: string;
  readonly componentName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly actualWeight: number;
}

export interface ProductDailyBomRecord {
  readonly id: string;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredAt: Date;
  readonly description: string | null;
  readonly standardBomMiCode: string;
  readonly materials: ProductDailyBomMaterialRecord[];
}

export abstract class BomDashboardRepository {
  /**
   * Returns every product with at least one daily BOM in the given range,
   * sorted by product name ascending. The productId/productName pair is
   * denormalised onto `bom` at registration (alongside `standardBomMiCode`/
   * `brand`/etc., via the `standard_bom` join at write time), so the
   * underlying group-by can be done in SQL without a second hop.
   */
  abstract listDashboardProducts(
    filters: BomDashboardFilters,
  ): Promise<ProductDashboardSummaryRecord[]>;

  /**
   * Returns every daily BOM for the given product in the given range, with
   * its (cloned) composition flattened to one row per material — the shape
   * `GetProductDailyBomsHandler` joins to the standard BOM's composition to
   * compute the score. Repository order is implementation detail; the
   * handler sorts the returned records by score desc before mapping.
   */
  abstract listProductDailyBoms(
    productId: Identity,
    filters: BomDashboardFilters,
  ): Promise<ProductDailyBomRecord[]>;
}
