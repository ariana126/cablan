import { Identity } from '@framework/domain';

// The read-side port behind the standard BOM reporting queries — mirrors
// `BomReportRepository` in `boms/`.
//
// A filter field absent means "unfiltered"; present as an empty array means
// "match nothing" — the caller (`StandardBomController`,
// `ReportManufacturingInstructionsHandler`) must preserve that distinction rather than
// defaulting a missing field to `[]`.
export interface ManufacturingInstructionReportFilters {
  readonly brands?: string[];
  readonly activeStatuses?: boolean[];
  readonly productNames?: string[];
  readonly componentNames?: string[];
  readonly miCodes?: string[];
}

export interface ManufacturingInstructionReportCriteria {
  readonly page: number;
  readonly pageSize: number;
  readonly filters: ManufacturingInstructionReportFilters;
  readonly sortBy?: 'productName';
  readonly sortDir?: 'asc' | 'desc';
}

export interface ManufacturingInstructionReportItemRecord {
  readonly id: string;
  readonly miCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly active: boolean;
}

export interface ManufacturingInstructionReportSearchResult {
  readonly items: ManufacturingInstructionReportItemRecord[];
  readonly total: number;
}

export interface ManufacturingInstructionFilterOptionsRecord {
  readonly brands: string[];
  readonly activeStatuses: boolean[];
  readonly productNames: string[];
  readonly componentNames: string[];
  readonly miCodes: string[];
}

// The export set's own shape ("خروجی اکسل آنالیز های استاندارد"): every
// filtered standard BOM, unpaginated, with its full composition — mirrors
// `BomExportRecord` in `boms/`. No `id`, since nothing downstream (the
// spreadsheet shaping in `infrastructure/spreadsheet/`) needs it. See
// src/modules/manufacturing-instructions/CLAUDE.md.
export interface ManufacturingInstructionExportMaterialRecord {
  readonly name: string;
  readonly weight: number;
}

export interface ManufacturingInstructionExportComponentRecord {
  readonly name: string;
  readonly materials: ManufacturingInstructionExportMaterialRecord[];
}

export interface ManufacturingInstructionExportRecord {
  readonly miCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly active: boolean;
  readonly productName: string;
  readonly description: string | null;
  readonly components: ManufacturingInstructionExportComponentRecord[];
}

export abstract class ManufacturingInstructionReportRepository {
  abstract search(
    criteria: ManufacturingInstructionReportCriteria,
  ): Promise<ManufacturingInstructionReportSearchResult>;

  abstract filterOptions(): Promise<ManufacturingInstructionFilterOptionsRecord>;

  abstract findDetailById(
    id: Identity,
  ): Promise<ManufacturingInstructionReportItemRecord | null>;

  abstract exportRecords(
    filters: ManufacturingInstructionReportFilters,
  ): Promise<ManufacturingInstructionExportRecord[]>;
}
