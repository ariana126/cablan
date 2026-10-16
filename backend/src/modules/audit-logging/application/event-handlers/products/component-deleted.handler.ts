import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { ComponentDeleted } from '@products/domain/events/component-deleted.event';

@DomainEventHandler(ComponentDeleted)
export class ComponentDeletedAuditHandler implements DomainEventHandlerOf<ComponentDeleted> {
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
