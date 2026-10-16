import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MaterialEdited } from '@products/domain/events/material-edited.event';

@EventsHandler(MaterialEdited)
export class MaterialEditedAuditHandler implements IEventHandler<MaterialEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.Material,
      event.materialId,
      AuditAction.Edited,
      event.changes,
    );
  }
}
