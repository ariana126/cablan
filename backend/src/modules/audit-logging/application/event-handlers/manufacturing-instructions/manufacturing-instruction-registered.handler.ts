import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import { ManufacturingInstructionRegistered } from '@manufacturing-instructions/domain/events/manufacturing-instruction-registered.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(ManufacturingInstructionRegistered)
export class ManufacturingInstructionRegisteredAuditHandler implements IEventHandler<ManufacturingInstructionRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ManufacturingInstructionRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.manufacturingInstructionId,
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
