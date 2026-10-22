import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  AuditLogControllerChanges200,
  AuditLogControllerChanges200ChangesItem,
  AuditLogControllerFilterOptions200,
  AuditLogControllerList200ItemsItem,
  AuditLogFiltersDto,
  ListAuditLogDto,
} from '../../api/model';
import { AuditLogService } from '../../api/audit-log/audit-log.service';

/** The six record types the audit log knows about — kept as a plain string union rather than the
 * generated (deeply nested, orval-named) enum, so nothing in `features/audit-log` has to import a
 * type named after an inline response schema. */
export type AppRecordType = 'User' | 'Product' | 'Component' | 'Material' | 'StandardBom' | 'Bom';

/** The kinds of event the audit log records: the three mutations every record type has, plus a
 * daily BOM's approval and its revocation. */
export type AppAuditAction = 'Registered' | 'Edited' | 'Deleted' | 'Approved' | 'ApprovalRevoked';

/** One row of the audit log — every field always present, unlike the generated response item. */
export interface AppAuditLogEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorName: string;
  readonly recordType: AppRecordType;
  readonly recordId: string;
  readonly action: AppAuditAction;
}

export interface AppAuditLogPage {
  readonly items: AppAuditLogEntry[];
  readonly total: number;
}

/** Every field optional and AND-combined server-side. For the three list fields an absent key means
 * "unfiltered" and an empty array means "match nothing" — the gateway forwards both as given. */
export interface AppAuditLogFilters {
  readonly actors?: readonly string[];
  readonly recordTypes?: readonly AppRecordType[];
  readonly actions?: readonly AppAuditAction[];
  readonly recordId?: string;
  readonly from?: string;
  readonly to?: string;
}

/** Every distinct value the log holds for the three list-valued filters, unfiltered. */
export interface AppAuditLogFilterOptions {
  readonly actors: string[];
  readonly recordTypes: AppRecordType[];
  readonly actions: AppAuditAction[];
}

/**
 * One field-level line of a single audit-log entry. Every action carries them: an `Edited` entry has
 * one `before → after` line per changed field, a `Registered` entry one `'' → value` line per field
 * it was registered with, and a `Deleted` entry one `value → ''` line per field it held. A
 * composition (a product's, standard BOM's or BOM's components) contributes one `component` line per
 * component. An empty side is `''` here; turning that into a placeholder is the view's job.
 */
export interface AppAuditLogChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

/**
 * The reference an entry's record is identified by — today a daily BOM's tracking number on its
 * `Approved`/`ApprovalRevoked` entries (`{ field: 'trackingNumber', value: 'TRK-3005' }`), since an
 * approval changes no field that would otherwise name the BOM. `field` is a key in the same
 * vocabulary as `AppAuditLogChange.field`.
 */
export interface AppAuditLogSubject {
  readonly field: string;
  readonly value: string;
}

/** A single entry's drill-in: its field-level changes, and its subject — `null` when it has none. */
export interface AppAuditLogChanges {
  readonly changes: AppAuditLogChange[];
  readonly subject: AppAuditLogSubject | null;
}

function toListDto(page: number, pageSize: number, filters?: AppAuditLogFilters): ListAuditLogDto {
  const dto: ListAuditLogDto = { page, pageSize };
  if (filters === undefined) {
    return dto;
  }

  const wire: AuditLogFiltersDto = {};
  if (filters.actors !== undefined) {
    wire.actors = [...filters.actors];
  }
  if (filters.recordTypes !== undefined) {
    wire.recordTypes = [...filters.recordTypes];
  }
  if (filters.actions !== undefined) {
    wire.actions = [...filters.actions];
  }
  if (filters.recordId !== undefined) {
    wire.recordId = filters.recordId;
  }
  if (filters.from !== undefined) {
    wire.from = filters.from;
  }
  if (filters.to !== undefined) {
    wire.to = filters.to;
  }

  if (Object.keys(wire).length > 0) {
    dto.filters = wire;
  }
  return dto;
}

function toAppAuditLogEntry(item: AuditLogControllerList200ItemsItem): AppAuditLogEntry {
  return {
    id: item.id ?? '',
    occurredAt: item.occurredAt ?? '',
    actorName: item.actorName ?? '',
    recordType: (item.recordType ?? 'User') as AppRecordType,
    recordId: item.recordId ?? '',
    action: (item.action ?? 'Registered') as AppAuditAction,
  };
}

function toAppAuditLogChange(item: AuditLogControllerChanges200ChangesItem): AppAuditLogChange {
  return {
    field: item.field ?? '',
    previousValue: item.previousValue ?? '',
    newValue: item.newValue ?? '',
  };
}

function toAppAuditLogChanges(response: AuditLogControllerChanges200): AppAuditLogChanges {
  const subject = response.subject ?? null;
  return {
    changes: (response.changes ?? []).map(toAppAuditLogChange),
    subject: subject === null ? null : { field: subject.field ?? '', value: subject.value ?? '' },
  };
}

/**
 * System-Admin-only access to the system-wide audit log — every mutating event across every module,
 * newest first. `list` 401s or 403s for anyone else; see `features/audit-log` for how the UI turns
 * that into an access-denied state.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogGateway {
  private readonly api = inject(AuditLogService);

  list(page: number, pageSize: number, filters?: AppAuditLogFilters): Observable<AppAuditLogPage> {
    return this.api.auditLogControllerList(toListDto(page, pageSize, filters)).pipe(
      map((response) => ({
        items: (response.items ?? []).map(toAppAuditLogEntry),
        total: response.total ?? 0,
      })),
    );
  }

  filterOptions(): Observable<AppAuditLogFilterOptions> {
    return this.api.auditLogControllerFilterOptions().pipe(
      map((response: AuditLogControllerFilterOptions200) => ({
        actors: response.actors ?? [],
        recordTypes: (response.recordTypes ?? []) as AppRecordType[],
        actions: (response.actions ?? []) as AppAuditAction[],
      })),
    );
  }

  changes(id: string): Observable<AppAuditLogChanges> {
    return this.api.auditLogControllerChanges(id).pipe(map(toAppAuditLogChanges));
  }
}
