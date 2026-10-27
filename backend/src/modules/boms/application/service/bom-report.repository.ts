import { ApprovalStatus } from '@boms/domain/value/approval-status';
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
  readonly orderNumbers?: string[];
  readonly trackingNumbers?: string[];
  readonly brands?: string[];
  readonly componentNames?: string[];
  readonly standardBomMiCodes?: string[];
  readonly productNames?: string[];
  readonly registeredByUsers?: string[];
  readonly approvalStatuses?: ApprovalStatus[];
  /**
   * Reviewer display names — whoever approved or rejected a BOM; `''` stands
   * for "no reviewer" (a pending BOM).
   */
  readonly reviewers?: string[];
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
  readonly approvalStatus: ApprovalStatus;
  readonly reviewedBy: string | null;
  readonly managementNote: string | null;
  /**
   * Whether this is the latest daily BOM of its tracking number, in
   * registration order — the fact `isResamplable` needs besides the status.
   */
  readonly isLatestOfTrackingNumber: boolean;
}

export interface BomReportSearchResult {
  readonly items: BomReportItemRecord[];
  readonly total: number;
}

export interface BomFilterOptionsRecord {
  readonly orderNumbers: string[];
  readonly trackingNumbers: string[];
  readonly brands: string[];
  readonly componentNames: string[];
  readonly standardBomMiCodes: string[];
  readonly productNames: string[];
  readonly registeredByUsers: string[];
  readonly approvalStatuses: ApprovalStatus[];
  /** Distinct non-null reviewer display names, approvals and rejections alike. */
  readonly reviewers: string[];
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
  readonly approvalStatus: ApprovalStatus;
  readonly reviewedBy: string | null;
  readonly managementNote: string | null;
  /**
   * Whether this is the latest daily BOM of its tracking number, in
   * registration order — the fact `isResamplable` needs besides the status.
   */
  readonly isLatestOfTrackingNumber: boolean;
  readonly components: BomDetailComponentRecord[];
}

// The export set's own shape ("خروجی اکسل آنالیز های روزانه"): every
// filtered daily BOM, unpaginated, with its full composition — but no `id`/
// `standardBomId`, since nothing downstream (the spreadsheet shaping in
// `infrastructure/spreadsheet/`) needs either. See src/modules/boms/CLAUDE.md.
export interface BomExportMaterialRecord {
  readonly name: string;
  readonly weight: number;
}

export interface BomExportComponentRecord {
  readonly name: string;
  readonly materials: BomExportMaterialRecord[];
}

export interface BomExportRecord {
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly registeredAt: Date;
  readonly registeredBy: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly productName: string;
  readonly description: string | null;
  readonly approvalStatus: ApprovalStatus;
  readonly reviewedBy: string | null;
  readonly managementNote: string | null;
  readonly components: BomExportComponentRecord[];
}

export abstract class BomReportRepository {
  abstract search(criteria: BomReportCriteria): Promise<BomReportSearchResult>;
  abstract filterOptions(): Promise<BomFilterOptionsRecord>;
  abstract findDetailById(id: Identity): Promise<BomDetailRecord | null>;
  abstract exportRecords(filters: BomReportFilters): Promise<BomExportRecord[]>;
}
