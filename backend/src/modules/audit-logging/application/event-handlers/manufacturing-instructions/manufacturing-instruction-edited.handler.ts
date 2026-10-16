import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { compositionReplacementChanges } from '@audit-logging/application/service/audit-snapshot';
import { ManufacturingInstructionEdited } from '@manufacturing-instructions/domain/events/manufacturing-instruction-edited.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

@EventsHandler(ManufacturingInstructionEdited)
export class ManufacturingInstructionEditedAuditHandler implements IEventHandler<ManufacturingInstructionEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ManufacturingInstructionEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.manufacturingInstructionId,
      AuditAction.Edited,
      [
        ...event.changes,
        ...(event.replacedComposition === null
          ? []
          : compositionReplacementChanges(
              event.replacedComposition.previous,
              event.replacedComposition.current,
            )),
      ],
    );
  }
}
