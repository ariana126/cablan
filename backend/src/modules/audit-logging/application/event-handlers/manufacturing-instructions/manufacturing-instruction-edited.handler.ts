import {
  AuditAction,
  AuditChange,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  compositionReplacementChanges,
  materialWeightChanges,
} from '@audit-logging/application/service/audit-snapshot';
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
          : compositionChanges(event.replacedComposition)),
      ],
    );
  }
}

// The System Admin's correction of a standard BOM in use (issue #126) moves
// only its weights, so an edit that changed nothing else of the composition
// reads per material, as a daily BOM's does; any other composition change
// keeps the per-component lines.
function compositionChanges(
  replacedComposition: NonNullable<
    ManufacturingInstructionEdited['replacedComposition']
  >,
): AuditChange[] {
  const { previous, current } = replacedComposition;
  return (
    materialWeightChanges(previous, current) ??
    compositionReplacementChanges(previous, current)
  );
}
