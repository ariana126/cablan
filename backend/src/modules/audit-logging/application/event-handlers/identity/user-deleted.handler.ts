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
import { UserDeleted } from '@identity/domain/events/user-deleted.event';

@DomainEventHandler(UserDeleted)
export class UserDeletedAuditHandler implements DomainEventHandlerOf<UserDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Deleted,
      AuditSnapshot.of({
        name: event.name,
        username: event.username,
        role: event.role,
      }).asDeletion(),
    );
  }
}
