import { Identity } from '@framework/domain';

// The finite set this module recognises, spelled out in
// src/modules/audit-logging/CLAUDE.md's brief: every mutating event wired up
// across the six source modules maps to exactly one of each. Stored as a
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
}

export enum AuditAction {
  Registered = 'Registered',
  Edited = 'Edited',
  Deleted = 'Deleted',
}

// A single field-level diff line — the shape every `*Edited`/`*Renamed`/
// `*Changed` domain event this module subscribes to either already carries
// (`StandardBomEdited.changes`, `BomEdited.changes`) or can be built from
// directly (`UsernameChanged.previousUsername`/`.newUsername`, etc.). See
// `AuditLogProjector`.
export interface AuditChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

export interface RecordAuditLogEntryInput {
  readonly occurredAt: Date;
  readonly actorId: string;
  readonly actorName: string;
  readonly recordType: AuditRecordType;
  readonly recordId: string;
  readonly action: AuditAction;
  readonly changes: AuditChange[];
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

// A filter field left `undefined` means "unfiltered" — every filter is
// AND-combined, mirroring `BomReportFilters`'s own convention (see
// `boms/application/service/bom-report.repository.ts`). `to` is expected to
// already be the exclusive start-of-next-day boundary computed by
// `ListAuditLogHandler` — this port never interprets calendar days itself,
// it only ever compares instants.
export interface AuditLogFilters {
  readonly actorName?: string;
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

export interface AuditLogChangeRecord {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

// The read-side port behind both HTTP endpoints
// (`ListAuditLogHandler`/`GetAuditLogChangesHandler`) and the write side
// every `@EventsHandler` in `application/event-handlers/` calls through
// `AuditLogProjector`. There is no separate write-model repository/port the
// way every other module has one: this module has no aggregate, so there is
// nothing to `find`/`get`/`save` in the `EntityRepository` sense — `record()`
// is the entire write surface.
export abstract class AuditLogRepository {
  abstract record(entry: RecordAuditLogEntryInput): Promise<void>;

  /**
   * Paginated, filtered, newest-first. Never joins or selects
   * `AuditLogEntryChange` rows — that is what keeps this query "optimized"
   * for a list, per src/modules/audit-logging/CLAUDE.md: a client viewing the
   * list never pays for change rows it isn't displaying.
   */
  abstract search(
    criteria: AuditLogSearchCriteria,
  ): Promise<AuditLogSearchResult>;

  /**
   * Returns `null` when no entry exists with the given id — distinct from an
   * entry that exists but has no changes (`Registered`/`Deleted` entries,
   * and `*ComponentsUpdated` entries — see
   * src/modules/audit-logging/CLAUDE.md), which resolve to `[]`.
   */
  abstract findChangesByEntryId(
    id: Identity,
  ): Promise<AuditLogChangeRecord[] | null>;
}
