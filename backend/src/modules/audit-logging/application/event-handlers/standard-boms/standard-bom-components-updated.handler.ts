import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StandardBomComponentsUpdated } from '@standard-boms/domain/events/standard-bom-components-updated.event';

// No field-level diff: the event carries only the new composition's
// component ids, not a comparable old/new pair per
// src/modules/audit-logging/CLAUDE.md's "enrich exactly two events" scope —
// only `StandardBomEdited`/`BomEdited` carry `changes`. This still projects
// as `Edited` (there is no dedicated "components updated" action — see
// prisma/schema/audit-logging.prisma), with an empty `changes` array, the
// same as a `Registered`/`Deleted` entry.
@EventsHandler(StandardBomComponentsUpdated)
export class StandardBomComponentsUpdatedAuditHandler implements IEventHandler<StandardBomComponentsUpdated> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: StandardBomComponentsUpdated): Promise<void> {
    await this.projector.project(
      AuditRecordType.StandardBom,
      event.standardBomId,
      AuditAction.Edited,
    );
  }
}
