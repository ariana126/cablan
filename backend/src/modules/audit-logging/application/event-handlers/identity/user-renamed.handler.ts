import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { UserRenamed } from '@identity/domain/events/user-renamed.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(UserRenamed)
export class UserRenamedAuditHandler implements IEventHandler<UserRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Edited,
      [
        {
          field: 'name',
          previousValue: event.previousName,
          newValue: event.newName,
        },
      ],
    );
  }
}
