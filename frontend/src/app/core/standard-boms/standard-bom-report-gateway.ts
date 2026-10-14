import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { StandardBomExportFormat, StandardBomReportFiltersDto } from '../../api/model';
import { StandardBomsService } from '../../api/standard-boms/standard-boms.service';
import { DownloadedFile, toDownloadedFile } from '../files/downloaded-file';

/** What the export is saved as when the API's `Content-Disposition` names nothing. */
export const STANDARD_BOM_EXPORT_FILE_NAME = 'گزارش-آنالیز-های-استاندارد.xlsx';

/** One row of the standard-BOM report list. */
export interface AppStandardBomReportRow {
  readonly id: string;
  readonly miCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly active: boolean;
}

export interface AppStandardBomReportPage {
  readonly items: AppStandardBomReportRow[];
  readonly total: number;
}

export interface AppStandardBomReportFilters {
  readonly brands?: string[];
  readonly activeStatuses?: boolean[];
  readonly productNames?: string[];
  readonly componentNames?: string[];
  readonly miCodes?: string[];
}

export type AppStandardBomReportSortBy = 'productName';
export type AppStandardBomReportSortDir = 'asc' | 'desc';

export interface AppStandardBomFilterOptions {
  readonly brands: string[];
  readonly activeStatuses: boolean[];
  readonly productNames: string[];
  readonly componentNames: string[];
  readonly miCodes: string[];
}

export interface AppStandardBomDetailMaterial {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface AppStandardBomDetailComponent {
  readonly id: string;
  readonly name: string;
  readonly materials: AppStandardBomDetailMaterial[];
}

export interface AppStandardBomDetail {
  readonly id: string;
  readonly miCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly standardLength: number;
  readonly active: boolean;
  readonly description: string;
  readonly components: AppStandardBomDetailComponent[];
  readonly totalWeight: number;
}

interface ReportStandardBomsBody {
  page: number;
  pageSize: number;
  filters?: {
    brands?: string[];
    activeStatuses?: boolean[];
    productNames?: string[];
    componentNames?: string[];
    miCodes?: string[];
  };
  sortBy?: 'productName';
  sortDir?: 'asc' | 'desc';
}

interface StandardBomReportItemResponse {
  id: string;
  miCode?: string;
  brand?: string;
  productName?: string;
  active?: boolean;
}

interface StandardBomReportPageResponse {
  items: StandardBomReportItemResponse[];
  total?: number;
}

interface StandardBomFilterOptionsResponse {
  brands?: string[];
  activeStatuses?: boolean[];
  productNames?: string[];
  componentNames?: string[];
  miCodes?: string[];
}

interface StandardBomDetailComponentMaterialResponse {
  id?: string;
  name?: string;
  weight?: number;
}

interface StandardBomDetailComponentResponse {
  id?: string;
  name?: string;
  materials?: StandardBomDetailComponentMaterialResponse[];
}

interface StandardBomDetailResponse {
  id?: string;
  miCode?: string;
  brand?: string;
  productName?: string;
  standardLength?: number;
  active?: boolean;
  description?: string;
  components?: StandardBomDetailComponentResponse[];
  totalWeight?: number;
}

function toAppStandardBomReportRow(item: StandardBomReportItemResponse): AppStandardBomReportRow {
  return {
    id: item.id ?? '',
    miCode: item.miCode ?? '',
    brand: item.brand ?? '',
    productName: item.productName ?? '',
    active: item.active ?? false,
  };
}

function toAppStandardBomReportPage(
  response: StandardBomReportPageResponse,
): AppStandardBomReportPage {
  return {
    items: (response.items ?? []).map(toAppStandardBomReportRow),
    total: response.total ?? 0,
  };
}

function toAppStandardBomFilterOptions(
  response: StandardBomFilterOptionsResponse,
): AppStandardBomFilterOptions {
  return {
    brands: response.brands ?? [],
    activeStatuses: response.activeStatuses ?? [],
    productNames: response.productNames ?? [],
    componentNames: response.componentNames ?? [],
    miCodes: response.miCodes ?? [],
  };
}

function toAppStandardBomDetailComponent(
  component: StandardBomDetailComponentResponse,
): AppStandardBomDetailComponent {
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

function toAppStandardBomDetail(item: StandardBomDetailResponse): AppStandardBomDetail {
  return {
    id: item.id ?? '',
    miCode: item.miCode ?? '',
    brand: item.brand ?? '',
    productName: item.productName ?? '',
    standardLength: item.standardLength ?? 0,
    active: item.active ?? false,
    description: item.description ?? '',
    components: (item.components ?? []).map(toAppStandardBomDetailComponent),
    totalWeight: item.totalWeight ?? 0,
  };
}

/**
 * The "گزارشگیر" (Reporter) role's own read side of the standard-BOM domain — a different endpoint
 * family from `StandardBomsGateway`'s (`GET /standard-boms`, register/edit/delete). Browsing the
 * report carries no role restriction (mirrors `boms/CLAUDE.md`'s reasoning), paginates and filters
 * server-side, and never fetches or holds the full dataset.
 *
 * The reporting methods use `HttpClient` directly because the generated `StandardBomsService`
 * currently only covers the management endpoints — `POST /api/standard-boms/report`,
 * `GET /api/standard-boms/report/filter-options` and `GET /api/standard-boms/report/detail/:miCode`
 * are not yet in the OpenAPI contract (the backend's spec must be regenerated first).
 * Once that is done and `npm run generate:api` is run again, these can be switched to the generated
 * service methods. `export` already has: `POST /api/standard-boms/report/export` is in the contract,
 * and its binary response is exactly what the generated client's `responseType: 'blob'` handles.
 */
@Injectable({ providedIn: 'root' })
export class StandardBomReportGateway {
  private readonly http = inject(HttpClient);
  private readonly api = inject(StandardBomsService);

  report(
    page: number,
    pageSize: number,
    filters?: AppStandardBomReportFilters,
    sortBy: AppStandardBomReportSortBy = 'productName',
    sortDir: AppStandardBomReportSortDir = 'asc',
  ): Observable<AppStandardBomReportPage> {
    const body: ReportStandardBomsBody = {
      page,
      pageSize,
      sortBy,
      sortDir,
    };

    if (filters) {
      const f: ReportStandardBomsBody['filters'] = {};
      if (filters.brands !== undefined) f.brands = filters.brands;
      if (filters.activeStatuses !== undefined) f.activeStatuses = filters.activeStatuses;
      if (filters.productNames !== undefined) f.productNames = filters.productNames;
      if (filters.componentNames !== undefined) f.componentNames = filters.componentNames;
      if (filters.miCodes !== undefined) f.miCodes = filters.miCodes;
      if (Object.keys(f).length > 0) body.filters = f;
    }

    return this.http
      .post<StandardBomReportPageResponse>('/api/standard-boms/report', body)
      .pipe(map(toAppStandardBomReportPage));
  }

  /**
   * The `.xlsx` workbook of every standard BOM matching `filters`, unpaginated, laid out in
   * `format` — built entirely server-side. `filters` is always sent as its own key, empty object
   * included, mirroring `BomReportGateway#export`: the caller (`StandardBomsPage`) always has its
   * `filters()` in hand.
   */
  export(
    format: StandardBomExportFormat,
    filters: AppStandardBomReportFilters,
  ): Observable<DownloadedFile> {
    const f: StandardBomReportFiltersDto = {};
    if (filters.brands !== undefined) f.brands = filters.brands;
    if (filters.activeStatuses !== undefined) f.activeStatuses = filters.activeStatuses;
    if (filters.productNames !== undefined) f.productNames = filters.productNames;
    if (filters.componentNames !== undefined) f.componentNames = filters.componentNames;
    if (filters.miCodes !== undefined) f.miCodes = filters.miCodes;

    return this.api
      .standardBomControllerExport({ format, filters: f }, { observe: 'response' })
      .pipe(map((response) => toDownloadedFile(response, STANDARD_BOM_EXPORT_FILE_NAME)));
  }

  filterOptions(): Observable<AppStandardBomFilterOptions> {
    return this.http
      .get<StandardBomFilterOptionsResponse>('/api/standard-boms/report/filter-options')
      .pipe(map(toAppStandardBomFilterOptions));
  }

  getDetail(miCode: string): Observable<AppStandardBomDetail> {
    return this.http
      .get<StandardBomDetailResponse>(
        `/api/standard-boms/report/detail/${encodeURIComponent(miCode)}`,
      )
      .pipe(map(toAppStandardBomDetail));
  }
}
