import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { EntityNotFound } from '@framework/domain';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  AuditLogChangeItem,
  AuditLogChanges,
} from './audit-log-changes.read-model';
import { GetAuditLogChangesQuery } from './get-audit-log-changes.query';

@QueryHandler(GetAuditLogChangesQuery)
export class GetAuditLogChangesHandler implements IQueryHandler<GetAuditLogChangesQuery> {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async execute(query: GetAuditLogChangesQuery): Promise<AuditLogChanges> {
    const changes = await this.auditLogRepository.findChangesByEntryId(
      query.auditLogEntryId,
    );
    if (changes === null) {
      throw EntityNotFound.withId(query.auditLogEntryId);
    }

    return new AuditLogChanges(
      changes.map(
        (change) =>
          new AuditLogChangeItem(
            change.field,
            change.previousValue,
            change.newValue,
          ),
      ),
    );
  }
}
