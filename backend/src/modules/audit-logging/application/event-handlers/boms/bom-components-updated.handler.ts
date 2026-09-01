import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomComponentsUpdated } from '@boms/domain/events/bom-components-updated.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

// No field-level diff — see `StandardBomComponentsUpdatedAuditHandler`'s own
// doc comment for why; the same reasoning applies here.
@EventsHandler(BomComponentsUpdated)
export class BomComponentsUpdatedAuditHandler implements IEventHandler<BomComponentsUpdated> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomComponentsUpdated): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Edited,
    );
  }
}
