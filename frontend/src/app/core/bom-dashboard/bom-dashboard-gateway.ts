import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BomsDashboardService } from '../../api/boms-dashboard/boms-dashboard.service';
import {
  BomDashboardControllerListProductDailyBoms200,
  BomDashboardControllerListProductDailyBoms200ItemsItem,
  BomDashboardControllerListProductDailyBoms200ItemsItemLinesItem,
  BomDashboardControllerListProducts200,
  BomDashboardControllerListProducts200ItemsItem,
  DashboardProductsDto,
  ProductDailyBomsDto,
} from '../../api/model';

/** One row of the dashboard's top-level product list — the bare facts the user needs to choose a
 * product to drill into. `productId` is the only opaque identifier the page carries forward; the
 * per-product panel keys off the *name* on the wire, so it never has to remember it. */
export interface AppBomDashboardProduct {
  readonly productId: string;
  readonly productName: string;
  readonly dailyBomCount: number;
  /** The newest registration time among the product's daily BOMs in the range (ISO instant). */
  readonly lastRegisteredAt: string;
}

export interface AppBomDashboardProductList {
  readonly items: AppBomDashboardProduct[];
}

export interface AppBomDashboardDailyBomLine {
  readonly componentName: string;
  readonly materialName: string;
  readonly actualWeight: number;
  readonly standardWeight: number;
  /** `|actualWeight - standardWeight|` — the absolute deviation, never negative — as the API
   * computes and rounds it; never recomputed here, so the screen cannot disagree with the score
   * the API orders by, built from the same differences. */
  readonly difference: number;
  readonly description: string;
}

/** One row of the per-product daily-BOM list — the analysis itself plus the per-line composition
 * the dashboard renders below it. The API sends the list highest score first (the score being the
 * sum of `|actualWeight - standardWeight|` over the BOM's material lines, the spec's own "امتیاز")
 * and that order is the only use the dashboard makes of it: the score itself is no longer shown,
 * so it is not carried here, and the list's order is kept exactly as it arrives. `description` and
 * `registeredBy` are optional in the underlying schema and are defaulted to `''` here, which the
 * page shows as a dash. */
export interface AppBomDashboardDailyBom {
  readonly id: string;
  readonly orderNumber: string;
  /** What the dashboard identifies a daily BOM by on screen — the order number is kept only
   * because the API still sends it. */
  readonly trackingNumber: string;
  readonly registeredAt: string;
  /** The display name of the quality-control operator who registered the daily BOM. */
  readonly registeredBy: string;
  readonly description: string;
  readonly lines: AppBomDashboardDailyBomLine[];
}

export interface AppBomDashboardDailyBomList {
  readonly items: AppBomDashboardDailyBom[];
}

/** A range filter, expressed as ISO instants. **Both fields are optional, and their absence has
 * a different meaning than `undefined` after spread**: passing `{ from: undefined, to: undefined }`
 * is the same as passing `{}` — both are "no range, give me all-time" — and a per-field `undefined`
 * must reach the request body as an absent key, exactly the way `BomReportFiltersDto` and
 * `DashboardProductsDto` are shaped. Building the right value per field is the UI's job
 * (`features/bom-dashboard/bom-dashboard-page.ts`); this gateway only ever forwards what it is
 * given. */
export interface AppBomDashboardRange {
  readonly from?: string;
  readonly to?: string;
}

function toRangeDto(range: AppBomDashboardRange): DashboardProductsDto {
  const dto: DashboardProductsDto = {};
  if (range.from !== undefined) {
    dto.from = range.from;
  }
  if (range.to !== undefined) {
    dto.to = range.to;
  }
  return dto;
}

function toAppBomDashboardProduct(
  item: BomDashboardControllerListProducts200ItemsItem,
): AppBomDashboardProduct {
  return {
    productId: item.productId ?? '',
    productName: item.productName ?? '',
    dailyBomCount: item.dailyBomCount ?? 0,
    lastRegisteredAt: item.lastRegisteredAt ?? '',
  };
}

function toAppBomDashboardProductList(
  response: BomDashboardControllerListProducts200,
): AppBomDashboardProductList {
  return {
    items: (response.items ?? []).map(toAppBomDashboardProduct),
  };
}

function toAppBomDashboardDailyBomLine(
  line: BomDashboardControllerListProductDailyBoms200ItemsItemLinesItem,
): AppBomDashboardDailyBomLine {
  return {
    componentName: line.componentName ?? '',
    materialName: line.materialName ?? '',
    actualWeight: line.actualWeight ?? 0,
    standardWeight: line.standardWeight ?? 0,
    difference: line.difference ?? 0,
    description: '',
  };
}

function toAppBomDashboardDailyBom(
  item: BomDashboardControllerListProductDailyBoms200ItemsItem,
): AppBomDashboardDailyBom {
  return {
    id: item.id ?? '',
    orderNumber: item.orderNumber ?? '',
    trackingNumber: item.trackingNumber ?? '',
    registeredAt: item.registeredAt ?? '',
    registeredBy: item.registeredBy ?? '',
    description: item.description ?? '',
    lines: (item.lines ?? []).map(toAppBomDashboardDailyBomLine),
  };
}

function toAppBomDashboardDailyBomList(
  response: BomDashboardControllerListProductDailyBoms200,
): AppBomDashboardDailyBomList {
  return {
    items: (response.items ?? []).map(toAppBomDashboardDailyBom),
  };
}

/**
 * "داشبورد بررسی روزانه آنالیز ها" (`bom-dashboard.feature`) — the daily-BOM dashboard's read
 * side. Two endpoints, two methods, and a deliberately different shape from `BomReportGateway`:
 * the product list carries only the bare facts the user needs to choose a product, and the
 * per-product daily-BOM list is fetched lazily on selection (mirrors the dispatch's "fetch each
 * product's boms with their details when the user selects that product"). Nothing here holds or
 * fetches the full dataset.
 */
@Injectable({ providedIn: 'root' })
export class BomDashboardGateway {
  private readonly api = inject(BomsDashboardService);

  products(range?: AppBomDashboardRange): Observable<AppBomDashboardProductList> {
    const dto: ProductDailyBomsDto = toRangeDto(range ?? {});
    return this.api.bomDashboardControllerListProducts(dto).pipe(map(toAppBomDashboardProductList));
  }

  dailyBoms(
    productId: string,
    range?: AppBomDashboardRange,
  ): Observable<AppBomDashboardDailyBomList> {
    const dto: ProductDailyBomsDto = toRangeDto(range ?? {});
    return this.api
      .bomDashboardControllerListProductDailyBoms(productId, dto)
      .pipe(map(toAppBomDashboardDailyBomList));
  }
}
