import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { MaterialRenamed } from '@materials/domain/events/material-renamed.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(MaterialRenamed)
export class MaterialRenamedAuditHandler implements IEventHandler<MaterialRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.Material,
      event.materialId,
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
