import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { ComponentRegistered } from '@components/domain/events/component-registered.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(ComponentRegistered)
export class ComponentRegisteredAuditHandler implements IEventHandler<ComponentRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ComponentRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Component,
      event.componentId,
      AuditAction.Registered,
    );
  }
}
