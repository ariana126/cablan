import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StandardBomDeleted } from '@standard-boms/domain/events/standard-bom-deleted.event';

@EventsHandler(StandardBomDeleted)
export class StandardBomDeletedAuditHandler implements IEventHandler<StandardBomDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: StandardBomDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.standardBomId,
      AuditAction.Deleted,
    );
  }
}
