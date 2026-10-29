import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { MaterialsImported } from '@products/domain/events/materials-imported.event';

import { materialImportLines } from './material-import-audit-lines';

@DomainEventHandler(MaterialsImported)
export class MaterialsImportedAuditHandler implements DomainEventHandlerOf<MaterialsImported> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: MaterialsImported): Promise<void> {
    await this.projector.project(
      AuditRecordType.MaterialImport,
      event.importId,
      AuditAction.Imported,
      materialImportLines(event.changes),
    );
  }
}
