import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { UserEdited } from '@identity/domain/events/user-edited.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(UserEdited)
export class UserEditedAuditHandler implements IEventHandler<UserEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Edited,
      event.changes,
    );
  }
}
