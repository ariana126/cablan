import {
  AuditAction,
  AuditChange,
  AuditLogRepository,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { ActorContext, Clock, DisplayNameProvider } from '@framework/domain';
import { Injectable, Logger } from '@nestjs/common';

/**
 * The single place every `@EventsHandler` in
 * `application/event-handlers/**` delegates to: resolves "who did this" via
 * `ActorContext` + `DisplayNameProvider`, "when" via `Clock`, and writes one
 * `AuditLogEntry` (plus its `changes`, if any) through `AuditLogRepository`.
 *
 * Two failure modes are absorbed here rather than propagated, per
 * src/modules/audit-logging/CLAUDE.md: no actor in context (shouldn't happen
 * behind a guarded mutating endpoint, but defensive), and any other failure
 * while resolving the actor's name or writing the entry. An audit-projection
 * failure must never fail the underlying business command it is reacting
 * to — the command has already been committed by the time this runs (see
 * `PrismaEntityRepository.save()`, which does not await `EventBus.publishAll`)
 * — so both are logged and swallowed rather than thrown.
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
  ): Promise<void> {
    try {
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
      });
    } catch (error) {
      this.logger.error(
        `Failed to project a ${recordType} ${action} audit entry for ${recordId}; skipping.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
