import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { ComponentRenamed } from '@components/domain/events/component-renamed.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(ComponentRenamed)
export class ComponentRenamedAuditHandler implements IEventHandler<ComponentRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ComponentRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.Component,
      event.componentId,
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
