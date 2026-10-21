import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  BomControllerFilterOptions200,
  BomExportFormat,
  BomControllerGet200,
  BomControllerGet200ComponentsItem,
  BomControllerReport200,
  BomControllerReport200ItemsItem,
  BomReportFiltersDto,
} from '../../api/model';
import { BomsService } from '../../api/boms/boms.service';
import { DownloadedFile, toDownloadedFile } from '../files/downloaded-file';
import { AppApprovalStatus } from '../i18n/approval-labels';

/** What the export is saved as when the API's `Content-Disposition` names nothing. */
export const BOM_EXPORT_FILE_NAME = 'گزارش-آنالیز-های-روزانه.xlsx';

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
  readonly approvalStatus: AppApprovalStatus;
  /** The approver's display name; `null` while unapproved. */
  readonly approvedBy: string | null;
}

export interface AppBomReportPage {
  readonly items: AppBomReportRow[];
  readonly total: number;
}

/**
 * The seven Excel-style checkbox fields plus the "تاریخ و زمان ثبت" range, exactly as
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
  readonly approvalStatuses?: AppApprovalStatus[];
  readonly approvers?: string[];
  readonly registeredAtFrom?: string;
  readonly registeredAtTo?: string;
}

export interface AppBomReportFilterOptions {
  readonly brands: string[];
  readonly componentNames: string[];
  readonly standardBomMiCodes: string[];
  readonly productNames: string[];
  readonly registeredByUsers: string[];
  readonly approvalStatuses: AppApprovalStatus[];
  /** Every distinct approver; a daily BOM nobody approved contributes none. */
  readonly approvers: string[];
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
  readonly approvalStatus: AppApprovalStatus;
  readonly approvedBy: string | null;
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
  if (filters.approvalStatuses !== undefined) {
    dto.approvalStatuses = filters.approvalStatuses;
  }
  if (filters.approvers !== undefined) {
    dto.approvers = filters.approvers;
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
    approvalStatus: item.approvalStatus ?? 'unapproved',
    approvedBy: item.approvedBy ?? null,
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
    approvalStatuses: response.approvalStatuses ?? [],
    approvers: response.approvers ?? [],
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
    approvalStatus: item.approvalStatus ?? 'unapproved',
    approvedBy: item.approvedBy ?? null,
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
   * The `.xlsx` workbook of every daily BOM matching `filters`, unpaginated, laid out in `format` —
   * built entirely server-side. `timeZone` is the browser's own, so «تاریخ و زمان ثبت» reads in the
   * workbook the way it reads on screen. Unlike `report` above, `filters` is always sent as its own
   * key, empty object included: the caller (`BomsPage`) always has its `filters()` in hand.
   */
  export(
    format: BomExportFormat,
    filters: AppBomReportFilters,
    timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  ): Observable<DownloadedFile> {
    return this.api
      .bomControllerExport(
        { format, timeZone, filters: toFiltersDto(filters) },
        { observe: 'response' },
      )
      .pipe(map((response) => toDownloadedFile(response, BOM_EXPORT_FILE_NAME)));
  }

  filterOptions(): Observable<AppBomReportFilterOptions> {
    return this.api.bomControllerFilterOptions().pipe(map(toAppBomReportFilterOptions));
  }

  get(id: string): Observable<AppBomDetail> {
    return this.api.bomControllerGet(id).pipe(map(toAppBomDetail));
  }
}
