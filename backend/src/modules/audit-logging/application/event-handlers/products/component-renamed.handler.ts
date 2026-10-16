import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { ComponentRenamed } from '@products/domain/events/component-renamed.event';

@DomainEventHandler(ComponentRenamed)
export class ComponentRenamedAuditHandler implements DomainEventHandlerOf<ComponentRenamed> {
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
