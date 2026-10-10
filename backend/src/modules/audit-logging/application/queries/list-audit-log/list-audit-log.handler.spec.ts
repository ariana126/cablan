import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { InMemoryAuditLogRepository } from '@audit-logging/application/support/in-memory-audit-log-repository';

import {
  endOfCalendarDayExclusive,
  ListAuditLogHandler,
} from './list-audit-log.handler';
import { ListAuditLogQuery } from './list-audit-log.query';

describe('endOfCalendarDayExclusive', () => {
  it('a midnight-UTC date becomes midnight-UTC the following day', () => {
    expect(
      endOfCalendarDayExclusive(new Date('2026-06-24T00:00:00.000Z')),
    ).toEqual(new Date('2026-06-25T00:00:00.000Z'));
  });

  it('a date with a non-midnight time still becomes midnight-UTC the following day — the whole calendar day is included regardless of the given time', () => {
    expect(
      endOfCalendarDayExclusive(new Date('2026-06-24T15:30:00.000Z')),
    ).toEqual(new Date('2026-06-25T00:00:00.000Z'));
  });

  it('crosses a month boundary correctly', () => {
    expect(
      endOfCalendarDayExclusive(new Date('2026-06-30T09:00:00.000Z')),
    ).toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });
});

describe('ListAuditLogHandler', () => {
  it("passes an entry occurring at 10:00 through a 'to' filter given as 00:00 the same day — the acceptance scenario this day-boundary logic exists for", async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    await auditLogRepository.record({
      occurredAt: new Date('2026-06-24T10:00:00.000Z'),
      actorId: 'actor-1',
      actorName: 'Nikrooz',
      recordType: AuditRecordType.Bom,
      recordId: 'bom-1',
      action: AuditAction.Edited,
      changes: [],
    });
    const sut = new ListAuditLogHandler(auditLogRepository);

    const result = await sut.execute(
      new ListAuditLogQuery(1, 20, {
        to: new Date('2026-06-24T00:00:00.000Z'),
      }),
    );

    expect(result.total).toBe(1);
    expect(result.items[0].recordId).toBe('bom-1');
  });

  it("excludes an entry occurring the day after a 'to' filter's calendar day", async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    await auditLogRepository.record({
      occurredAt: new Date('2026-06-25T00:00:01.000Z'),
      actorId: 'actor-1',
      actorName: 'Nikrooz',
      recordType: AuditRecordType.Bom,
      recordId: 'bom-1',
      action: AuditAction.Edited,
      changes: [],
    });
    const sut = new ListAuditLogHandler(auditLogRepository);

    const result = await sut.execute(
      new ListAuditLogQuery(1, 20, {
        to: new Date('2026-06-24T00:00:00.000Z'),
      }),
    );

    expect(result.total).toBe(0);
  });

  it('AND-combines actors, recordId and a from/to date range', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    await auditLogRepository.record({
      occurredAt: new Date('2026-06-24T09:00:00.000Z'),
      actorId: 'actor-1',
      actorName: 'Mostafa',
      recordType: AuditRecordType.StandardBom,
      recordId: 'standard-bom-1',
      action: AuditAction.Edited,
      changes: [],
    });
    await auditLogRepository.record({
      occurredAt: new Date('2026-06-24T09:05:00.000Z'),
      actorId: 'actor-2',
      actorName: 'Yashar',
      recordType: AuditRecordType.StandardBom,
      recordId: 'standard-bom-1',
      action: AuditAction.Deleted,
      changes: [],
    });
    const sut = new ListAuditLogHandler(auditLogRepository);

    const result = await sut.execute(
      new ListAuditLogQuery(1, 20, {
        actors: ['Mostafa'],
        recordId: 'standard-bom-1',
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-30T00:00:00.000Z'),
      }),
    );

    expect(result.total).toBe(1);
    expect(result.items[0].actorName).toBe('Mostafa');
  });

  it('matches any of several selected actors, record types and actions', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    const base = {
      occurredAt: new Date('2026-06-24T09:00:00.000Z'),
      actorId: 'a',
      recordId: 'r',
      changes: [],
    };
    await auditLogRepository.record({
      ...base,
      actorName: 'Mostafa',
      recordType: AuditRecordType.Bom,
      action: AuditAction.Edited,
    });
    await auditLogRepository.record({
      ...base,
      actorName: 'Yashar',
      recordType: AuditRecordType.User,
      action: AuditAction.Edited,
    });
    await auditLogRepository.record({
      ...base,
      actorName: 'Sina',
      recordType: AuditRecordType.Bom,
      action: AuditAction.Deleted,
    });
    const sut = new ListAuditLogHandler(auditLogRepository);

    const result = await sut.execute(
      new ListAuditLogQuery(1, 20, {
        actors: ['Mostafa', 'Yashar'],
        recordTypes: [AuditRecordType.Bom, AuditRecordType.User],
        actions: [AuditAction.Edited],
      }),
    );

    expect(
      result.items
        .map((item) => item.actorName)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['Mostafa', 'Yashar']);
  });

  it('keeps an empty multi-value filter as match-nothing, distinct from an absent one', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    await auditLogRepository.record({
      occurredAt: new Date('2026-06-24T09:00:00.000Z'),
      actorId: 'a',
      actorName: 'Mostafa',
      recordType: AuditRecordType.Bom,
      recordId: 'r',
      action: AuditAction.Edited,
      changes: [],
    });
    const sut = new ListAuditLogHandler(auditLogRepository);

    const none = await sut.execute(
      new ListAuditLogQuery(1, 20, { actors: [] }),
    );
    const all = await sut.execute(new ListAuditLogQuery(1, 20, {}));

    expect(none.total).toBe(0);
    expect(all.total).toBe(1);
  });

  it('maps each entry to the read model, formatting occurredAt as an ISO string', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    await auditLogRepository.record({
      occurredAt: new Date('2026-06-22T04:00:00.000Z'),
      actorId: 'actor-1',
      actorName: 'Yashar',
      recordType: AuditRecordType.User,
      recordId: 'user-1',
      action: AuditAction.Deleted,
      changes: [],
    });
    const sut = new ListAuditLogHandler(auditLogRepository);

    const result = await sut.execute(new ListAuditLogQuery(1, 20, {}));

    expect(result.items).toEqual([
      {
        id: 'entry-0',
        occurredAt: '2026-06-22T04:00:00.000Z',
        actorName: 'Yashar',
        recordType: AuditRecordType.User,
        recordId: 'user-1',
        action: AuditAction.Deleted,
      },
    ]);
  });

  it('lists no entries when none match', async () => {
    const sut = new ListAuditLogHandler(new InMemoryAuditLogRepository());

    const result = await sut.execute(new ListAuditLogQuery(1, 20, {}));

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('passes page and pageSize through to the repository unchanged', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    const sut = new ListAuditLogHandler(auditLogRepository);

    await sut.execute(new ListAuditLogQuery(2, 10, {}));

    expect(auditLogRepository.lastSearchCriteria?.page).toBe(2);
    expect(auditLogRepository.lastSearchCriteria?.pageSize).toBe(10);
  });
});
