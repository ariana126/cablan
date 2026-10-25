import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomReturnedToPending } from '@boms/domain/events/bom-returned-to-pending.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

// Projected right after the edit's own `Edited` entry, in the same
// transaction — the `sequence` tie-breaker lists it as the newer of the two.
@DomainEventHandler(BomReturnedToPending)
export class BomReturnedToPendingAuditHandler implements DomainEventHandlerOf<BomReturnedToPending> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomReturnedToPending): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.ReturnedToPending,
      event.changes,
      { field: 'trackingNumber', value: event.trackingNumber },
    );
  }
}
