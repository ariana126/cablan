import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AuditLogEntryItem, AuditLogPage } from './audit-log.read-model';
import { ListAuditLogQuery } from './list-audit-log.query';

/**
 * `to`, per src/modules/audit-logging/CLAUDE.md's brief, is a *calendar day*
 * filter, inclusive of that whole day — not a raw instant. `2026-06-24` and
 * `2026-06-24T15:30:00.000Z` mean the same thing: "through the end of 24
 * June", which this expresses as an *exclusive* lower bound on the next
 * day, always at UTC midnight (the timezone `@db.Timestamptz` columns are
 * compared in). An entry at `2026-06-24T23:59:59.999Z` must still match a
 * `to` of `2026-06-24T00:00:00.000Z`, which is exactly what an exclusive
 * `< 2026-06-25T00:00:00.000Z` bound gives.
 */
export function endOfCalendarDayExclusive(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
}

@QueryHandler(ListAuditLogQuery)
export class ListAuditLogHandler implements IQueryHandler<ListAuditLogQuery> {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async execute(query: ListAuditLogQuery): Promise<AuditLogPage> {
    const result = await this.auditLogRepository.search({
      page: query.page,
      pageSize: query.pageSize,
      filters: {
        actorName: query.filters.actorName,
        recordId: query.filters.recordId,
        from: query.filters.from,
        to:
          query.filters.to === undefined
            ? undefined
            : endOfCalendarDayExclusive(query.filters.to),
      },
    });

    return new AuditLogPage(
      result.items.map(
        (item) =>
          new AuditLogEntryItem(
            item.id,
            item.occurredAt.toISOString(),
            item.actorName,
            item.recordType,
            item.recordId,
            item.action,
          ),
      ),
      result.total,
    );
  }
}
