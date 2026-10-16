import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaterialEdited } from '@products/domain/events/material-edited.event';

@DomainEventHandler(MaterialEdited)
export class MaterialEditedAuditHandler implements DomainEventHandlerOf<MaterialEdited> {
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
