import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { InMemoryAuditLogRepository } from '@audit-logging/application/support/in-memory-audit-log-repository';

import { AuditLogFilterOptionsHandler } from './audit-log-filter-options.handler';

describe('AuditLogFilterOptionsHandler', () => {
  it('returns every distinct filterable value as a read model', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    auditLogRepository.respondToFilterOptionsWith({
      actors: ['Mostafa', 'Yashar'],
      recordTypes: [AuditRecordType.Bom, AuditRecordType.User],
      actions: [AuditAction.Registered, AuditAction.Edited],
    });
    const sut = new AuditLogFilterOptionsHandler(auditLogRepository);

    const result = await sut.execute();

    expect(result).toEqual({
      actors: ['Mostafa', 'Yashar'],
      recordTypes: [AuditRecordType.Bom, AuditRecordType.User],
      actions: [AuditAction.Registered, AuditAction.Edited],
    });
  });

  it('derives the options from the recorded entries, each value once', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    for (const actorName of ['Yashar', 'Mostafa', 'Yashar']) {
      await auditLogRepository.record({
        occurredAt: new Date('2026-06-24T09:00:00.000Z'),
        actorId: actorName,
        actorName,
        recordType: AuditRecordType.Bom,
        recordId: 'bom-1',
        action: AuditAction.Edited,
        changes: [],
      });
    }
    const sut = new AuditLogFilterOptionsHandler(auditLogRepository);

    const result = await sut.execute();

    expect(result).toEqual({
      actors: ['Mostafa', 'Yashar'],
      recordTypes: [AuditRecordType.Bom],
      actions: [AuditAction.Edited],
    });
  });

  it('returns empty option lists when nothing was ever recorded', async () => {
    const sut = new AuditLogFilterOptionsHandler(
      new InMemoryAuditLogRepository(),
    );

    const result = await sut.execute();

    expect(result).toEqual({ actors: [], recordTypes: [], actions: [] });
  });
});
