import {
  AuditAction,
  AuditChange,
  AuditLogRepository,
  AuditRecordType,
  AuditSubject,
} from '@audit-logging/application/service/audit-log.repository';
import { ActorContext, Clock, DisplayNameProvider } from '@framework/domain';
import { Injectable, Logger } from '@nestjs/common';

/**
 * The single place every `@DomainEventHandler` in
 * `application/event-handlers/**` delegates to: resolves "who did this" via
 * `ActorContext` + `DisplayNameProvider`, "when" via `Clock`, and writes one
 * `AuditLogEntry` (plus its `changes`) through `AuditLogRepository`.
 *
 * It runs inside the aggregate write's transaction:
 * `PrismaEntityRepository.save()`/`delete()` await
 * `DomainEventDispatcher.dispatch()` within `txHost.withTransaction()`. So
 * any failure here, whether resolving the actor's name or writing the
 * entry, propagates and rolls the change back with it (ADR 0007,
 * src/modules/audit-logging/CLAUDE.md). Do not catch it.
 *
 * The one case still skipped rather than failed is no actor in context: a
 * system action with no human behind it (`DefaultAdminSeeder` at boot or
 * after a test-stack truncate). It is logged, and the change commits
 * without an entry.
 */
@Injectable()
export class AuditLogProjector {
  private readonly logger = new Logger(AuditLogProjector.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly displayNameProvider: DisplayNameProvider,
    private readonly actorContext: ActorContext,
    private readonly clock: Clock,
  ) {}

  async project(
    recordType: AuditRecordType,
    recordId: string,
    action: AuditAction,
    changes: AuditChange[] = [],
    subject: AuditSubject | null = null,
  ): Promise<void> {
    const actorId = this.actorContext.currentUserId();
    if (actorId === null) {
      this.logger.warn(
        `No actor in context while projecting a ${recordType} ${action} audit entry for ${recordId}; skipping.`,
      );
      return;
    }

    const actorName = await this.displayNameProvider.getName(actorId);

    await this.auditLogRepository.record({
      occurredAt: this.clock.now(),
      actorId: actorId.asString(),
      actorName,
      recordType,
      recordId,
      action,
      changes,
      subject,
    });
  }
}
