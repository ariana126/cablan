import {
  AuditLogChangeRecord,
  AuditLogRepository,
  AuditLogSearchCriteria,
  AuditLogSearchResult,
  RecordAuditLogEntryInput,
} from '@audit-logging/application/service/audit-log.repository';
import { Identity } from '@framework/domain';

// A hand-written fake, not a mock: from a query handler's or the projector's
// point of view, `AuditLogRepository` is an in-process collaborator, so
// tests use a real (if simplified) implementation that records what it was
// asked and returns a scripted response, rather than asserting call-by-call
// on a generic spy. It does not replicate `PrismaAuditLogRepository`'s own
// filtering/pagination/sorting SQL — that translation is
// infrastructure-specific — but `search()` does honour the AND-combined
// actorName/recordId/occurredAt-range filters in plain JS, since
// `ListAuditLogHandler`'s own spec relies on that to prove it passes the
// (already day-boundary-adjusted) filters through correctly.
export class InMemoryAuditLogRepository extends AuditLogRepository {
  public readonly recorded: RecordAuditLogEntryInput[] = [];
  public lastSearchCriteria: AuditLogSearchCriteria | undefined;
  public lastChangesLookupId: Identity | undefined;
  private changesByEntryId = new Map<string, AuditLogChangeRecord[]>();

  record(entry: RecordAuditLogEntryInput): Promise<void> {
    this.recorded.push(entry);
    return Promise.resolve();
  }

  search(criteria: AuditLogSearchCriteria): Promise<AuditLogSearchResult> {
    this.lastSearchCriteria = criteria;
    const { actorName, recordId, from, to } = criteria.filters;
    const matching = this.recorded
      .filter(
        (entry) => actorName === undefined || entry.actorName === actorName,
      )
      .filter((entry) => recordId === undefined || entry.recordId === recordId)
      .filter((entry) => from === undefined || entry.occurredAt >= from)
      .filter((entry) => to === undefined || entry.occurredAt < to)
      .toSorted((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const start = (criteria.page - 1) * criteria.pageSize;
    const page = matching.slice(start, start + criteria.pageSize);

    return Promise.resolve({
      items: page.map((entry, index) => ({
        id: `entry-${start + index}`,
        occurredAt: entry.occurredAt,
        actorName: entry.actorName,
        recordType: entry.recordType,
        recordId: entry.recordId,
        action: entry.action,
      })),
      total: matching.length,
    });
  }

  seedChanges(id: string, changes: AuditLogChangeRecord[]): void {
    this.changesByEntryId.set(id, changes);
  }

  findChangesByEntryId(id: Identity): Promise<AuditLogChangeRecord[] | null> {
    this.lastChangesLookupId = id;
    return Promise.resolve(this.changesByEntryId.get(id.asString()) ?? null);
  }
}
