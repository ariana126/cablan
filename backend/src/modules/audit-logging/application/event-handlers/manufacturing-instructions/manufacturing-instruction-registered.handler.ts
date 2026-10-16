import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { ManufacturingInstructionRegistered } from '@manufacturing-instructions/domain/events/manufacturing-instruction-registered.event';

@DomainEventHandler(ManufacturingInstructionRegistered)
export class ManufacturingInstructionRegisteredAuditHandler implements DomainEventHandlerOf<ManufacturingInstructionRegistered> {
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
