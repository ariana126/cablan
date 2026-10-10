import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { MaterialRegistered } from '@materials/domain/events/material-registered.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(MaterialRegistered)
export class MaterialRegisteredAuditHandler implements IEventHandler<MaterialRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Material,
      event.materialId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name, code: event.code }).asRegistration(),
    );
  }
}
