import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BomsDashboardService } from '../../api/boms-dashboard/boms-dashboard.service';
import { AppApprovalStatus } from '../i18n/approval-labels';
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

/** One material line of a daily BOM. The two ids are what an inline weight correction sends back
 * (`material-weight-edit.ts`); the names are what the dashboard shows. The standard weight and the
 * difference are still on the wire but no longer shown (`bom-dashboard.feature`), so they are not
 * carried here. */
export interface AppBomDashboardDailyBomLine {
  readonly componentId: string;
  readonly componentName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly actualWeight: number;
}

/** One daily BOM of the per-product list, identified on screen by its order number — the tracking
 * number is no longer shown, so it is not carried. The API sends the list highest score first (the
 * sum of `|actualWeight - standardWeight|` over the BOM's lines) and that order is the only use the
 * dashboard makes of it: the score itself is not shown, and the list's order is kept exactly as it
 * arrives. `description` and `registeredBy` are optional in the schema and default to `''`, which
 * the page shows as a dash. `standardBomMiCode` is what an inline weight correction re-sends. */
export interface AppBomDashboardDailyBom {
  readonly id: string;
  readonly orderNumber: string;
  readonly registeredAt: string;
  /** The display name of the quality-control operator who registered the daily BOM. */
  readonly registeredBy: string;
  readonly description: string;
  readonly standardBomMiCode: string;
  readonly approvalStatus: AppApprovalStatus;
  /** The approver's display name; `null` while unapproved. */
  readonly approvedBy: string | null;
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
    componentId: line.componentId ?? '',
    componentName: line.componentName ?? '',
    materialId: line.materialId ?? '',
    materialName: line.materialName ?? '',
    actualWeight: line.actualWeight ?? 0,
  };
}

function toAppBomDashboardDailyBom(
  item: BomDashboardControllerListProductDailyBoms200ItemsItem,
): AppBomDashboardDailyBom {
  return {
    id: item.id ?? '',
    orderNumber: item.orderNumber ?? '',
    registeredAt: item.registeredAt ?? '',
    registeredBy: item.registeredBy ?? '',
    description: item.description ?? '',
    standardBomMiCode: item.standardBomMiCode ?? '',
    approvalStatus: item.approvalStatus ?? 'unapproved',
    approvedBy: item.approvedBy ?? null,
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
