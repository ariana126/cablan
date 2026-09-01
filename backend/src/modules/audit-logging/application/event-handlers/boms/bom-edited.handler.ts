import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomEdited } from '@boms/domain/events/bom-edited.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(BomEdited)
export class BomEditedAuditHandler implements IEventHandler<BomEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Edited,
      event.changes,
    );
  }
}
