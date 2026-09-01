import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { UserRegistered } from '@identity/domain/events/user-registered.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(UserRegistered)
export class UserRegisteredAuditHandler implements IEventHandler<UserRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: UserRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.User,
      event.userId,
      AuditAction.Registered,
    );
  }
}
