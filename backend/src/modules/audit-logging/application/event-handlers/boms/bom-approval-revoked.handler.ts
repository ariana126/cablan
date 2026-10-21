import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomApprovalRevoked } from '@boms/domain/events/bom-approval-revoked.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(BomApprovalRevoked)
export class BomApprovalRevokedAuditHandler implements DomainEventHandlerOf<BomApprovalRevoked> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomApprovalRevoked): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.ApprovalRevoked,
      event.changes,
    );
  }
}
