import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { UserRegistered } from '@identity/domain/events/user-registered.event';

@DomainEventHandler(UserRegistered)
export class UserRegisteredAuditHandler implements DomainEventHandlerOf<UserRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Registered,
      AuditSnapshot.of({
        name: event.name,
        username: event.username,
        role: event.role,
      }).asRegistration(),
    );
  }
}
