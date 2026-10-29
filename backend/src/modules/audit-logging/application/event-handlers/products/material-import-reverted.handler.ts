import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaterialImportReverted } from '@products/domain/events/material-import-reverted.event';

import { materialImportReversionLines } from './material-import-audit-lines';

@DomainEventHandler(MaterialImportReverted)
export class MaterialImportRevertedAuditHandler implements DomainEventHandlerOf<MaterialImportReverted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialImportReverted): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaterialImport,
      event.importId,
      AuditAction.Reverted,
      materialImportReversionLines(event.changes),
    );
  }
}
