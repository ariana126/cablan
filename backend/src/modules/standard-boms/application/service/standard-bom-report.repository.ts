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
}

export abstract class StandardBomReportRepository {
  abstract search(
    criteria: StandardBomReportCriteria,
  ): Promise<StandardBomReportSearchResult>;

  abstract filterOptions(): Promise<StandardBomFilterOptionsRecord>;

  abstract findDetailById(
    id: Identity,
  ): Promise<StandardBomReportItemRecord | null>;
}
