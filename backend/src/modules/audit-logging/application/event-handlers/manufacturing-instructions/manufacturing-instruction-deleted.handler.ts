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
import { ManufacturingInstructionDeleted } from '@manufacturing-instructions/domain/events/manufacturing-instruction-deleted.event';

@DomainEventHandler(ManufacturingInstructionDeleted)
export class ManufacturingInstructionDeletedAuditHandler implements DomainEventHandlerOf<ManufacturingInstructionDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ManufacturingInstructionDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.manufacturingInstructionId,
      AuditAction.Deleted,
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
      ).asDeletion(),
    );
  }
}
