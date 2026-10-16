import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { BomDeleted } from '@boms/domain/events/bom-deleted.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(BomDeleted)
export class BomDeletedAuditHandler implements DomainEventHandlerOf<BomDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Deleted,
      AuditSnapshot.of(
        {
          orderNumber: event.snapshot.orderNumber,
          trackingNumber: event.snapshot.trackingNumber,
          miCode: event.snapshot.standardBomMiCode,
          productName: event.snapshot.productName,
          brand: event.snapshot.brand,
          standardLength: event.snapshot.standardLength,
          description: event.snapshot.description,
          registeredBy: event.snapshot.registeredBy,
        },
        event.snapshot.components,
      ).asDeletion(),
    );
  }
}
