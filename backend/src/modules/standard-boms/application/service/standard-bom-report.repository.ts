import { Identity } from '@framework/domain';

// The read-side port behind the standard BOM reporting queries — mirrors
// `BomReportRepository` in `boms/`.
//
// A filter field absent means "unfiltered"; present as an empty array means
// "match nothing" — the caller (`StandardBomController`,
// `ReportStandardBomsHandler`) must preserve that distinction rather than
// defaulting a missing field to `[]`.
export interface StandardBomReportFilters {
  readonly brands?: string[];
  readonly activeStatuses?: boolean[];
  readonly productNames?: string[];
  readonly componentNames?: string[];
  readonly miCodes?: string[];
}

export interface StandardBomReportCriteria {
  readonly page: number;
  readonly pageSize: number;
  readonly filters: StandardBomReportFilters;
  readonly sortBy?: 'productName';
  readonly sortDir?: 'asc' | 'desc';
}

export interface StandardBomReportItemRecord {
  readonly id: string;
  readonly miCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly active: boolean;
}

export interface StandardBomReportSearchResult {
  readonly items: StandardBomReportItemRecord[];
  readonly total: number;
}

export interface StandardBomFilterOptionsRecord {
  readonly brands: string[];
  readonly activeStatuses: boolean[];
  readonly productNames: string[];
  readonly componentNames: string[];
  readonly miCodes: string[];
}

// The export set's own shape ("خروجی اکسل آنالیز های استاندارد"): every
// filtered standard BOM, unpaginated, with its full composition — mirrors
// `BomExportRecord` in `boms/`. No `id`, since nothing downstream (the
// frontend's spreadsheet shaping) needs it. See
// src/modules/standard-boms/CLAUDE.md.
export interface StandardBomExportMaterialRecord {
  readonly name: string;
  readonly weight: number;
}

export interface StandardBomExportComponentRecord {
  readonly name: string;
  readonly materials: StandardBomExportMaterialRecord[];
}

export interface StandardBomExportRecord {
  readonly miCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly active: boolean;
  readonly productName: string;
  readonly description: string | null;
  readonly components: StandardBomExportComponentRecord[];
}

export abstract class StandardBomReportRepository {
  abstract search(
    criteria: StandardBomReportCriteria,
  ): Promise<StandardBomReportSearchResult>;

  abstract filterOptions(): Promise<StandardBomFilterOptionsRecord>;

  abstract findDetailById(
    id: Identity,
  ): Promise<StandardBomReportItemRecord | null>;

  abstract exportRecords(
    filters: StandardBomReportFilters,
  ): Promise<StandardBomExportRecord[]>;
}
