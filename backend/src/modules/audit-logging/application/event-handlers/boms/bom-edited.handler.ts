import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { compositionReplacementChanges } from '@audit-logging/application/service/audit-snapshot';
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
          : compositionReplacementChanges(
              event.replacedComposition.previous,
              event.replacedComposition.current,
            )),
      ],
    );
  }
}
