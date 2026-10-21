import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomApproved } from '@boms/domain/events/bom-approved.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(BomApproved)
export class BomApprovedAuditHandler implements DomainEventHandlerOf<BomApproved> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomApproved): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Approved,
      event.changes,
    );
  }
}
