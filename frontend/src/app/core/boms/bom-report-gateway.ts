import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  BomControllerExport200ItemsItem,
  BomControllerExport200ItemsItemComponentsItem,
  BomControllerFilterOptions200,
  BomControllerGet200,
  BomControllerGet200ComponentsItem,
  BomControllerReport200,
  BomControllerReport200ItemsItem,
  BomReportFiltersDto,
} from '../../api/model';
import { BomsService } from '../../api/boms/boms.service';

/** One row of the daily-BOM report list — every field always present, unlike the generated item. */
export interface AppBomReportRow {
  readonly id: string;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredAt: string;
  readonly registeredBy: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly productName: string;
}

export interface AppBomReportPage {
  readonly items: AppBomReportRow[];
  readonly total: number;
}

/**
 * The five Excel-style checkbox fields plus the "تاریخ و زمان ثبت" range, exactly as
 * `BomReportFiltersDto` shapes them. **A field left `undefined` means "no filter" and must be sent
 * as an absent key; `[]` means "match nothing" and must be sent as an explicit empty array** — the
 * backend distinguishes the two on purpose, so nothing in this gateway or its caller may collapse
 * one into the other. Building the right value per field is the UI's job (`bom-reports-page.ts`);
 * this gateway only ever forwards what it is given.
 */
export interface AppBomReportFilters {
  readonly brands?: string[];
  readonly componentNames?: string[];
  readonly standardBomMiCodes?: string[];
  readonly productNames?: string[];
  readonly registeredByUsers?: string[];
  readonly registeredAtFrom?: string;
  readonly registeredAtTo?: string;
}

export interface AppBomReportFilterOptions {
  readonly brands: string[];
  readonly componentNames: string[];
  readonly standardBomMiCodes: string[];
  readonly productNames: string[];
  readonly registeredByUsers: string[];
}

export interface AppBomDetailMaterial {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface AppBomDetailComponent {
  readonly id: string;
  readonly name: string;
  readonly materials: AppBomDetailMaterial[];
}

export interface AppBomExportMaterial {
  readonly name: string;
  readonly weight: number;
}

export interface AppBomExportComponent {
  readonly name: string;
  readonly materials: AppBomExportMaterial[];
}

/**
 * One daily BOM in the unpaginated, client-shaped-for-Excel export set — a different shape from
 * `AppBomReportRow` (that one is one *list row*; this one carries the full composition an export
 * row/columns needs) and a different shape from `AppBomDetail` (that one exists, `description`
 * defaults to `''`, matching a screen that always has something to show). Here a missing
 * `description` becomes `null`, on purpose: `features/boms/bom-report-export.ts` renders
 * `null` as the literal `"-"` cell `exporting-bom.feature`'s own worked example expects, which a
 * defaulted `''` could never be told apart from a *deliberately blank* description.
 */
export interface AppBomExportItem {
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredAt: string;
  readonly registeredBy: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly productName: string;
  readonly description: string | null;
  readonly components: AppBomExportComponent[];
}

export interface AppBomDetail {
  readonly id: string;
  readonly standardBomId: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly standardLength: number;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredBy: string;
  readonly registeredAt: string;
  readonly description: string;
  readonly components: AppBomDetailComponent[];
  /** Computed server-side — never recomputed client-side. */
  readonly totalWeight: number;
}

/**
 * Copies only the keys `filters` actually carries into a `BomReportFiltersDto` — a field left
 * `undefined` must not reach the request body at all (that is what "no filter" means to the
 * backend), and a plain object spread or cast would still leave the key present with an `undefined`
 * value. Conditional assignment is what actually omits it.
 */
function toFiltersDto(filters: AppBomReportFilters): BomReportFiltersDto {
  const dto: BomReportFiltersDto = {};

  if (filters.brands !== undefined) {
    dto.brands = filters.brands;
  }
  if (filters.componentNames !== undefined) {
    dto.componentNames = filters.componentNames;
  }
  if (filters.standardBomMiCodes !== undefined) {
    dto.standardBomMiCodes = filters.standardBomMiCodes;
  }
  if (filters.productNames !== undefined) {
    dto.productNames = filters.productNames;
  }
  if (filters.registeredByUsers !== undefined) {
    dto.registeredByUsers = filters.registeredByUsers;
  }
  if (filters.registeredAtFrom !== undefined) {
    dto.registeredAtFrom = filters.registeredAtFrom;
  }
  if (filters.registeredAtTo !== undefined) {
    dto.registeredAtTo = filters.registeredAtTo;
  }

  return dto;
}

function toAppBomReportRow(item: BomControllerReport200ItemsItem): AppBomReportRow {
  return {
    id: item.id ?? '',
    orderNumber: item.orderNumber ?? '',
    trackingNumber: item.trackingNumber ?? '',
    registeredAt: item.registeredAt ?? '',
    registeredBy: item.registeredBy ?? '',
    standardBomMiCode: item.standardBomMiCode ?? '',
    brand: item.brand ?? '',
    productName: item.productName ?? '',
  };
}

function toAppBomReportPage(response: BomControllerReport200): AppBomReportPage {
  return {
    items: (response.items ?? []).map(toAppBomReportRow),
    total: response.total ?? 0,
  };
}

function toAppBomReportFilterOptions(
  response: BomControllerFilterOptions200,
): AppBomReportFilterOptions {
  return {
    brands: response.brands ?? [],
    componentNames: response.componentNames ?? [],
    standardBomMiCodes: response.standardBomMiCodes ?? [],
    productNames: response.productNames ?? [],
    registeredByUsers: response.registeredByUsers ?? [],
  };
}

function toAppBomDetailComponent(
  component: BomControllerGet200ComponentsItem,
): AppBomDetailComponent {
  return {
    id: component.id ?? '',
    name: component.name ?? '',
    materials: (component.materials ?? []).map((material) => ({
      id: material.id ?? '',
      name: material.name ?? '',
      weight: material.weight ?? 0,
    })),
  };
}

function toAppBomExportComponent(
  component: BomControllerExport200ItemsItemComponentsItem,
): AppBomExportComponent {
  return {
    name: component.name ?? '',
    materials: (component.materials ?? []).map((material) => ({
      name: material.name ?? '',
      weight: material.weight ?? 0,
    })),
  };
}

function toAppBomExportItem(item: BomControllerExport200ItemsItem): AppBomExportItem {
  return {
    orderNumber: item.orderNumber ?? '',
    trackingNumber: item.trackingNumber ?? '',
    registeredAt: item.registeredAt ?? '',
    registeredBy: item.registeredBy ?? '',
    standardBomMiCode: item.standardBomMiCode ?? '',
    brand: item.brand ?? '',
    standardLength: item.standardLength ?? 0,
    productName: item.productName ?? '',
    description: item.description ?? null,
    components: (item.components ?? []).map(toAppBomExportComponent),
  };
}

function toAppBomDetail(item: BomControllerGet200): AppBomDetail {
  return {
    id: item.id ?? '',
    standardBomId: item.standardBomId ?? '',
    standardBomMiCode: item.standardBomMiCode ?? '',
    brand: item.brand ?? '',
    productName: item.productName ?? '',
    standardLength: item.standardLength ?? 0,
    orderNumber: item.orderNumber ?? '',
    trackingNumber: item.trackingNumber ?? '',
    registeredBy: item.registeredBy ?? '',
    registeredAt: item.registeredAt ?? '',
    description: item.description ?? '',
    components: (item.components ?? []).map(toAppBomDetailComponent),
    totalWeight: item.totalWeight ?? 0,
  };
}

/**
 * The "گزارشگیر" (Reporter) role's own read side of the daily-BOM domain — a different endpoint
 * family from `BomsGateway`'s (`GET /boms`, register/edit/delete), which is why this is its own
 * gateway rather than another method there: browsing the report carries no role restriction at all,
 * paginates and filters server-side, and never fetches or holds the full dataset.
 */
@Injectable({ providedIn: 'root' })
export class BomReportGateway {
  private readonly api = inject(BomsService);

  report(
    page: number,
    pageSize: number,
    filters?: AppBomReportFilters,
  ): Observable<AppBomReportPage> {
    return this.api
      .bomControllerReport(
        filters === undefined
          ? { page, pageSize }
          : { page, pageSize, filters: toFiltersDto(filters) },
      )
      .pipe(map(toAppBomReportPage));
  }

  /**
   * Every daily BOM matching `filters`, unpaginated — the whole filtered result set, not one page of
   * it — for `features/boms/bom-report-export.ts` to shape into a spreadsheet client-side.
   * Unlike `report` above, `filters` is always sent as its own key, empty object included: there is
   * no "no filters at all" case to distinguish here, since the caller (`BomsPage`) always has
   * its own `filters()` computed signal in hand, even when every field in it is unset.
   */
  export(filters: AppBomReportFilters): Observable<AppBomExportItem[]> {
    return this.api
      .bomControllerExport({ filters: toFiltersDto(filters) })
      .pipe(map((response) => (response.items ?? []).map(toAppBomExportItem)));
  }

  filterOptions(): Observable<AppBomReportFilterOptions> {
    return this.api.bomControllerFilterOptions().pipe(map(toAppBomReportFilterOptions));
  }

  get(id: string): Observable<AppBomDetail> {
    return this.api.bomControllerGet(id).pipe(map(toAppBomDetail));
  }
}
