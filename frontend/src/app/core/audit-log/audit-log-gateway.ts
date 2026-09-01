import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  AuditLogControllerChanges200ChangesItem,
  AuditLogControllerList200ItemsItem,
  ListAuditLogDto,
} from '../../api/model';
import { AuditLogService } from '../../api/audit-log/audit-log.service';

/** The six record types the audit log knows about — kept as a plain string union rather than the
 * generated (deeply nested, orval-named) enum, so nothing in `features/audit-log` has to import a
 * type named after an inline response schema. */
export type AppRecordType = 'User' | 'Product' | 'Component' | 'Material' | 'StandardBom' | 'Bom';

/** The three kinds of mutating event the audit log records. */
export type AppAuditAction = 'Registered' | 'Edited' | 'Deleted';

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

/** All four optional and AND-combined server-side — `POST /api/audit-log` itself decides what an
 * absent field means, this gateway only ever forwards what it is given. */
export interface AppAuditLogFilters {
  readonly actorName?: string;
  readonly recordId?: string;
  readonly from?: string;
  readonly to?: string;
}

/** One field-level change of a single edited entry — `[]` for a Registered or Deleted entry, since
 * neither carries a before/after to show. */
export interface AppAuditLogChange {
  readonly field: string;
  readonly previousValue: string;
  readonly newValue: string;
}

function toListDto(page: number, pageSize: number, filters?: AppAuditLogFilters): ListAuditLogDto {
  const dto: ListAuditLogDto = { page, pageSize };

  if (filters?.actorName !== undefined) {
    dto.actorName = filters.actorName;
  }
  if (filters?.recordId !== undefined) {
    dto.recordId = filters.recordId;
  }
  if (filters?.from !== undefined) {
    dto.from = filters.from;
  }
  if (filters?.to !== undefined) {
    dto.to = filters.to;
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

  changes(id: string): Observable<AppAuditLogChange[]> {
    return this.api
      .auditLogControllerChanges(id)
      .pipe(map((response) => (response.changes ?? []).map(toAppAuditLogChange)));
  }
}
