import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { UsernameChanged } from '@identity/domain/events/username-changed.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(UsernameChanged)
export class UsernameChangedAuditHandler implements IEventHandler<UsernameChanged> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UsernameChanged): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Edited,
      [
        {
          field: 'username',
          previousValue: event.previousUsername,
          newValue: event.newUsername,
        },
      ],
    );
  }
}
