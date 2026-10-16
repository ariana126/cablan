import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MaterialDeleted } from '@products/domain/events/material-deleted.event';

@EventsHandler(MaterialDeleted)
export class MaterialDeletedAuditHandler implements IEventHandler<MaterialDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Material,
      event.materialId,
      AuditAction.Deleted,
      AuditSnapshot.of({ name: event.name, code: event.code }).asDeletion(),
    );
  }
}
