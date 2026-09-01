import { InMemoryAuditLogRepository } from '@audit-logging/application/support/in-memory-audit-log-repository';
import {
  ActorContext,
  Clock,
  DisplayNameProvider,
  Identity,
} from '@framework/domain';

import { AuditAction, AuditRecordType } from './audit-log.repository';
import { AuditLogProjector } from './audit-log-projector.service';

const NOW = new Date('2026-06-22T04:00:00.000Z');

class FixedClock extends Clock {
  now(): Date {
    return NOW;
  }
}

class StubActorContext extends ActorContext {
  constructor(private readonly userId: Identity | null) {
    super();
  }

  currentUserId(): Identity | null {
    return this.userId;
  }
}

class StubDisplayNameProvider extends DisplayNameProvider {
  constructor(
    private readonly namesById: Map<string, string>,
    private readonly failWith?: Error,
  ) {
    super();
  }

  getName(userId: Identity): Promise<string> {
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    return Promise.resolve(this.namesById.get(userId.asString()) ?? 'Unknown');
  }
}

function makeSut(
  actorId: Identity | null,
  namesById: Map<string, string> = new Map(),
  displayNameFailure?: Error,
) {
  const auditLogRepository = new InMemoryAuditLogRepository();
  const sut = new AuditLogProjector(
    auditLogRepository,
    new StubDisplayNameProvider(namesById, displayNameFailure),
    new StubActorContext(actorId),
    new FixedClock(),
  );
  return { sut, auditLogRepository };
}

describe('AuditLogProjector', () => {
  it('records an entry stamped with the current actor, their resolved display name and the current time', async () => {
    const actorId = Identity.new();
    const { sut, auditLogRepository } = makeSut(
      actorId,
      new Map([[actorId.asString(), 'Yashar']]),
    );

    await sut.project(AuditRecordType.User, 'user-1', AuditAction.Registered);

    expect(auditLogRepository.recorded).toEqual([
      {
        occurredAt: NOW,
        actorId: actorId.asString(),
        actorName: 'Yashar',
        recordType: AuditRecordType.User,
        recordId: 'user-1',
        action: AuditAction.Registered,
        changes: [],
      },
    ]);
  });

  it('passes the given changes through unchanged', async () => {
    const actorId = Identity.new();
    const { sut, auditLogRepository } = makeSut(
      actorId,
      new Map([[actorId.asString(), 'Mostafa']]),
    );
    const changes = [
      { field: 'standardLength', previousValue: '305', newValue: '310' },
    ];

    await sut.project(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Edited,
      changes,
    );

    expect(auditLogRepository.recorded[0].changes).toBe(changes);
  });

  it('skips projecting, without throwing, when there is no actor in context', async () => {
    const { sut, auditLogRepository } = makeSut(null);

    await expect(
      sut.project(AuditRecordType.User, 'user-1', AuditAction.Deleted),
    ).resolves.toBeUndefined();
    expect(auditLogRepository.recorded).toEqual([]);
  });

  it('swallows a failure resolving the actor’s display name rather than letting it propagate', async () => {
    const actorId = Identity.new();
    const { sut, auditLogRepository } = makeSut(
      actorId,
      new Map(),
      new Error('user not found'),
    );

    await expect(
      sut.project(AuditRecordType.User, 'user-1', AuditAction.Registered),
    ).resolves.toBeUndefined();
    expect(auditLogRepository.recorded).toEqual([]);
  });

  it('swallows a failure writing the entry rather than letting it propagate', async () => {
    const actorId = Identity.new();
    const auditLogRepository = new InMemoryAuditLogRepository();
    auditLogRepository.record = () => Promise.reject(new Error('db down'));
    const sut = new AuditLogProjector(
      auditLogRepository,
      new StubDisplayNameProvider(new Map([[actorId.asString(), 'Yashar']])),
      new StubActorContext(actorId),
      new FixedClock(),
    );

    await expect(
      sut.project(AuditRecordType.User, 'user-1', AuditAction.Registered),
    ).resolves.toBeUndefined();
  });
});
