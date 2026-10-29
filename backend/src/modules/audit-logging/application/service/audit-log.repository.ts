import { Identity } from '@framework/domain';

// The finite set this module recognises, spelled out in
// src/modules/audit-logging/CLAUDE.md's brief: every mutating event wired up
// across the four source modules maps to exactly one of each. Stored as a
// plain `String` column (see prisma/schema/audit-logging.prisma), the same
// convention `app_user.role` already uses — the finite set is enforced here,
// in the application layer, not by a Prisma enum.
export enum AuditRecordType {
  User = 'User',
  Product = 'Product',
  Component = 'Component',
  Material = 'Material',
  StandardBom = 'StandardBom',
  Bom = 'Bom',
  // A bulk import of materials from the accounting software's Excel (issue
  // #74): one entry per import or reversion, none per material it touched.
  MaterialImport = 'MaterialImport',
  // CMMS (issue #69): equipment, the activity catalog, PM plan items (owned
  // by equipment, audited as records of their own so an entry names the one
  // item it changed) and executions.
  Equipment = 'Equipment',
  MaintenanceActivity = 'MaintenanceActivity',
  PmPlanItem = 'PmPlanItem',
  MaintenanceExecution = 'MaintenanceExecution',
}

export enum AuditAction {
  Registered = 'Registered',
  Edited = 'Edited',
  Deleted = 'Deleted',
  // A daily BOM's review: approved, rejected, or sent back to pending by an
  // edit. Not `Edited`: a review is a decision about the record, not a change
  // to its content — so an edit of a reviewed BOM is an `Edited` entry
  // followed by its own `ReturnedToPending` entry.
  Approved = 'Approved',
  Rejected = 'Rejected',
  ReturnedToPending = 'ReturnedToPending',
  // No longer written: daily BOMs lost "revoke approval" in issue #61. Kept
  // because entries written before then carry it, and the list must still
  // read and filter them.
  ApprovalRevoked = 'ApprovalRevoked',
  // A material import's two actions: applied, then possibly undone.
  Imported = 'Imported',
  Reverted = 'Reverted',
  // Equipment taken out of service (issue #69): kept, never deleted, so its
  // history stays — not `Deleted`.
  Retired = 'Retired',
}

// A single field-level line — the shape every `*Edited`/`*Renamed` domain
// event this module subscribes to either already carries
// (`ManufacturingInstructionEdited.changes`, `BomEdited.changes`) or can be built from
// directly, and the shape `AuditSnapshot` renders a `*Registered`/`*Deleted`
// event's snapshot into (`''` → value, value → `''`). See
// `AuditLogProjector` and `audit-snapshot.ts`.
export interface AuditChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

// The reference a reader identifies the record by (a daily BOM's
// `trackingNumber`), shown beside an entry's changes rather than among them:
// a reference that did not change is not a change. Optional per entry — only
// a daily BOM's review entries (Approved/Rejected/ReturnedToPending, and the
// retired ApprovalRevoked) carry one today.
export interface AuditSubject {
  readonly field: string;
  readonly value: string;
}

export interface RecordAuditLogEntryInput {
  readonly occurredAt: Date;
  readonly actorId: string;
  readonly actorName: string;
  readonly recordType: AuditRecordType;
  readonly recordId: string;
  readonly action: AuditAction;
  readonly changes: AuditChange[];
  readonly subject: AuditSubject | null;
}

// The list query's own row shape — deliberately without `changes`: see
// `AuditLogRepository.search()`'s own doc comment for why that split is what
// keeps the list query "optimized".
export interface AuditLogEntryRecord {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorName: string;
  readonly recordType: AuditRecordType;
  readonly recordId: string;
  readonly action: AuditAction;
}

// A filter field left `undefined` means "unfiltered"; a multi-value field
// present as an empty array means "match nothing" — every filter is
// AND-combined, mirroring `BomReportFilters`'s own convention (see
// `boms/application/service/bom-report.repository.ts`). `to` is expected to
// already be the exclusive start-of-next-day boundary computed by
// `ListAuditLogHandler` — this port never interprets calendar days itself,
// it only ever compares instants.
export interface AuditLogFilters {
  readonly actors?: string[];
  readonly recordTypes?: AuditRecordType[];
  readonly actions?: AuditAction[];
  readonly recordId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface AuditLogSearchCriteria {
  readonly page: number;
  readonly pageSize: number;
  readonly filters: AuditLogFilters;
}

export interface AuditLogSearchResult {
  readonly items: AuditLogEntryRecord[];
  readonly total: number;
}

export interface AuditLogFilterOptionsRecord {
  readonly actors: string[];
  readonly recordTypes: AuditRecordType[];
  readonly actions: AuditAction[];
}

export interface AuditLogChangeRecord {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

export interface AuditLogChangesRecord {
  readonly changes: AuditLogChangeRecord[];
  readonly subject: AuditSubject | null;
}

// The read-side port behind both HTTP endpoints
// (`ListAuditLogHandler`/`GetAuditLogChangesHandler`) and the write side
// every `@DomainEventHandler` in `application/event-handlers/` calls through
// `AuditLogProjector`. There is no separate write-model repository/port the
// way every other module has one: this module has no aggregate, so there is
// nothing to `find`/`get`/`save` in the `EntityRepository` sense — `record()`
// is the entire write surface.
export abstract class AuditLogRepository {
  abstract record(entry: RecordAuditLogEntryInput): Promise<void>;

  /**
   * Paginated, filtered, newest-first — entries sharing an `occurredAt` (an
   * edit and the revocation it caused, written in one transaction) come
   * newest-recorded first. Never joins or selects
   * `AuditLogEntryChange` rows — that is what keeps this query "optimized"
   * for a list, per src/modules/audit-logging/CLAUDE.md: a client viewing the
   * list never pays for change rows it isn't displaying.
   */
  abstract search(
    criteria: AuditLogSearchCriteria,
  ): Promise<AuditLogSearchResult>;

  /**
   * Every distinct value currently present for each multi-select filter,
   * unfiltered — what populates the client's "excel-style" filter lists.
   */
  abstract filterOptions(): Promise<AuditLogFilterOptionsRecord>;

  /**
   * Returns `null` when no entry exists with the given id — distinct from an
   * entry that exists but has no changes, which resolves to `changes: []`
   * (only rows written before every entry carried details — see
   * src/modules/audit-logging/CLAUDE.md). Lines come back in the order they
   * were recorded, beside the entry's subject (`null` when it has none).
   */
  abstract findChangesByEntryId(
    id: Identity,
  ): Promise<AuditLogChangesRecord | null>;
}
