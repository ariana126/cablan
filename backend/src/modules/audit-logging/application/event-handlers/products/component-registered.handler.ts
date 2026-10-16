import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ComponentRegistered } from '@products/domain/events/component-registered.event';

@EventsHandler(ComponentRegistered)
export class ComponentRegisteredAuditHandler implements IEventHandler<ComponentRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ComponentRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Component,
      event.componentId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name }).asRegistration(),
    );
  }
}
