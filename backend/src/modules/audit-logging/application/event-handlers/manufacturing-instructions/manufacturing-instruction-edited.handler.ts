import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { compositionReplacementChanges } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { ManufacturingInstructionEdited } from '@manufacturing-instructions/domain/events/manufacturing-instruction-edited.event';

@DomainEventHandler(ManufacturingInstructionEdited)
export class ManufacturingInstructionEditedAuditHandler implements DomainEventHandlerOf<ManufacturingInstructionEdited> {
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
