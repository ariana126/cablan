import { Identity } from '@framework/domain';

// The read-side port behind the reporting queries ("مشاهده آنالیز روزانه"):
// `ReportBomsHandler`, `BomFilterOptionsHandler` and `GetBomHandler` (see
// their own directories under `application/queries/`). Unlike `BomRepository`
// — which loads/saves the full write-model aggregate — this port is
// projection-shaped: pagination, filtering and sorting are pushed down into
// the query itself rather than loaded in full and sliced in memory, which is
// why it is a separate port instead of another method on `BomRepository`. See
// src/modules/boms/CLAUDE.md.
//
// A filter field left `undefined` means "unfiltered"; a filter field present
// as an empty array means "match nothing" — the caller (`BomController`,
// `ReportBomsHandler`) must preserve that distinction rather than defaulting
// a missing field to `[]`.
export interface BomReportFilters {
  readonly brands?: string[];
  readonly componentNames?: string[];
  readonly standardBomMiCodes?: string[];
  readonly productNames?: string[];
  readonly registeredByUsers?: string[];
  readonly registeredAtFrom?: Date;
  readonly registeredAtTo?: Date;
}

export interface BomReportCriteria {
  readonly page: number;
  readonly pageSize: number;
  readonly filters: BomReportFilters;
}

export interface BomReportItemRecord {
  readonly id: string;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredAt: Date;
  readonly registeredBy: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly productName: string;
}

export interface BomReportSearchResult {
  readonly items: BomReportItemRecord[];
  readonly total: number;
}

export interface BomFilterOptionsRecord {
  readonly brands: string[];
  readonly componentNames: string[];
  readonly standardBomMiCodes: string[];
  readonly productNames: string[];
  readonly registeredByUsers: string[];
}

export interface BomDetailMaterialRecord {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface BomDetailComponentRecord {
  readonly id: string;
  readonly name: string;
  readonly materials: BomDetailMaterialRecord[];
}

export interface BomDetailRecord {
  readonly id: string;
  readonly standardBomId: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly standardLength: number;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredBy: string;
  readonly registeredAt: Date;
  readonly description: string | null;
  readonly components: BomDetailComponentRecord[];
}

export abstract class BomReportRepository {
  abstract search(criteria: BomReportCriteria): Promise<BomReportSearchResult>;
  abstract filterOptions(): Promise<BomFilterOptionsRecord>;
  abstract findDetailById(id: Identity): Promise<BomDetailRecord | null>;
}
