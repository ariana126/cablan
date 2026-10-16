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
import { MaterialRegistered } from '@products/domain/events/material-registered.event';

@DomainEventHandler(MaterialRegistered)
export class MaterialRegisteredAuditHandler implements DomainEventHandlerOf<MaterialRegistered> {
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
