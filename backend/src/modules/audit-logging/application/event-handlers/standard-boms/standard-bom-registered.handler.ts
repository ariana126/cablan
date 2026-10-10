import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StandardBomRegistered } from '@standard-boms/domain/events/standard-bom-registered.event';

@EventsHandler(StandardBomRegistered)
export class StandardBomRegisteredAuditHandler implements IEventHandler<StandardBomRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: StandardBomRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.standardBomId,
      AuditAction.Registered,
      AuditSnapshot.of(
        {
          miCode: event.snapshot.miCode,
          productName: event.snapshot.productName,
          brand: event.snapshot.brand,
          standardLength: event.snapshot.standardLength,
          active: event.snapshot.active,
          description: event.snapshot.description,
        },
        event.snapshot.components,
      ).asRegistration(),
    );
  }
}
