import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { compositionReplacementChanges } from '@audit-logging/application/service/audit-snapshot';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StandardBomEdited } from '@standard-boms/domain/events/standard-bom-edited.event';

@EventsHandler(StandardBomEdited)
export class StandardBomEditedAuditHandler implements IEventHandler<StandardBomEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: StandardBomEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.standardBomId,
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
