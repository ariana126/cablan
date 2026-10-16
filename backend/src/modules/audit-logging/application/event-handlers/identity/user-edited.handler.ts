import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { UserEdited } from '@identity/domain/events/user-edited.event';

@DomainEventHandler(UserEdited)
export class UserEditedAuditHandler implements DomainEventHandlerOf<UserEdited> {
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
