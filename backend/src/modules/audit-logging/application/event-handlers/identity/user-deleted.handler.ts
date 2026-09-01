import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { UserDeleted } from '@identity/domain/events/user-deleted.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(UserDeleted)
export class UserDeletedAuditHandler implements IEventHandler<UserDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Deleted,
    );
  }
}
