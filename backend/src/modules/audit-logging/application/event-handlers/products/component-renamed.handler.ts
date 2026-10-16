import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ComponentRenamed } from '@products/domain/events/component-renamed.event';

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
