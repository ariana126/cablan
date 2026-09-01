import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomDeleted } from '@boms/domain/events/bom-deleted.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(BomDeleted)
export class BomDeletedAuditHandler implements IEventHandler<BomDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Deleted,
    );
  }
}
