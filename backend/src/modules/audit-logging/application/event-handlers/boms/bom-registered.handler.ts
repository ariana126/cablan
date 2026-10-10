import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { BomRegistered } from '@boms/domain/events/bom-registered.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(BomRegistered)
export class BomRegisteredAuditHandler implements IEventHandler<BomRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
      AuditAction.Registered,
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
      ).asRegistration(),
    );
  }
}
