import { InMemoryAuditLogRepository } from '@audit-logging/application/support/in-memory-audit-log-repository';
import { EntityNotFound, Identity } from '@framework/domain';

import { GetAuditLogChangesHandler } from './get-audit-log-changes.handler';
import { GetAuditLogChangesQuery } from './get-audit-log-changes.query';

describe('GetAuditLogChangesHandler', () => {
  it("returns an audit log entry's field-level changes", async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    const id = Identity.new();
    auditLogRepository.seedChanges(id.asString(), [
      { field: 'standardLength', previousValue: '305', newValue: '310' },
      { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
    ]);
    const sut = new GetAuditLogChangesHandler(auditLogRepository);

    const result = await sut.execute(new GetAuditLogChangesQuery(id));

    expect(result).toEqual({
      changes: [
        { field: 'standardLength', previousValue: '305', newValue: '310' },
        { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
      ],
      subject: null,
    });
  });

  it('returns the subject a reader identifies the record by, beside its changes', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    const id = Identity.new();
    auditLogRepository.seedChanges(
      id.asString(),
      [
        {
          field: 'approvalStatus',
          previousValue: 'unapproved',
          newValue: 'approved',
        },
      ],
      { field: 'trackingNumber', value: 'TRK-3005' },
    );
    const sut = new GetAuditLogChangesHandler(auditLogRepository);

    const result = await sut.execute(new GetAuditLogChangesQuery(id));

    expect(result.subject).toEqual({
      field: 'trackingNumber',
      value: 'TRK-3005',
    });
  });

  it('returns an empty change list for an entry with no recorded changes (e.g. Registered/Deleted)', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    const id = Identity.new();
    auditLogRepository.seedChanges(id.asString(), []);
    const sut = new GetAuditLogChangesHandler(auditLogRepository);

    const result = await sut.execute(new GetAuditLogChangesQuery(id));

    expect(result.changes).toEqual([]);
  });

  it('rejects an id that does not resolve to an existing audit log entry', async () => {
    const auditLogRepository = new InMemoryAuditLogRepository();
    const sut = new GetAuditLogChangesHandler(auditLogRepository);

    await expect(
      sut.execute(new GetAuditLogChangesQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
