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
import { BomEdited } from '@boms/domain/events/bom-edited.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(BomEdited)
export class BomEditedAuditHandler implements DomainEventHandlerOf<BomEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: BomEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.Bom,
      event.bomId,
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

// A daily BOM's weights are what its edits mostly change (the dashboard's
// inline weight edit), so an edit that changed nothing else reads per
// material; any other composition change keeps the per-component lines.
function compositionChanges(
  replacedComposition: NonNullable<BomEdited['replacedComposition']>,
): AuditChange[] {
  const { previous, current } = replacedComposition;
  return (
    materialWeightChanges(previous, current) ??
    compositionReplacementChanges(previous, current)
  );
}
