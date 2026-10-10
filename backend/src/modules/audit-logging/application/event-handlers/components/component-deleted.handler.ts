import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { ComponentDeleted } from '@components/domain/events/component-deleted.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(ComponentDeleted)
export class ComponentDeletedAuditHandler implements IEventHandler<ComponentDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ComponentDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Component,
      event.componentId,
      AuditAction.Deleted,
      AuditSnapshot.of({ name: event.name }).asDeletion(),
    );
  }
}
