import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomRejected } from '@boms/domain/events/bom-rejected.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(BomRejected)
export class BomRejectedAuditHandler implements DomainEventHandlerOf<BomRejected> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomRejected): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Rejected,
      event.changes,
      { field: 'trackingNumber', value: event.trackingNumber },
    );
  }
}
