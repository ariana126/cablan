import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { UserRoleChanged } from '@identity/domain/events/user-role-changed.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(UserRoleChanged)
export class UserRoleChangedAuditHandler implements IEventHandler<UserRoleChanged> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserRoleChanged): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Edited,
      [
        {
          field: 'role',
          previousValue: event.previousRole,
          newValue: event.newRole,
        },
      ],
    );
  }
}
