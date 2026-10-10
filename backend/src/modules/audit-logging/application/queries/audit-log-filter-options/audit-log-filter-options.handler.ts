import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AuditLogFilterOptionsQuery } from './audit-log-filter-options.query';
import { AuditLogFilterOptions } from './audit-log-filter-options.read-model';

@QueryHandler(AuditLogFilterOptionsQuery)
export class AuditLogFilterOptionsHandler implements IQueryHandler<AuditLogFilterOptionsQuery> {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async execute(): Promise<AuditLogFilterOptions> {
    const options = await this.auditLogRepository.filterOptions();
    return new AuditLogFilterOptions(
      options.actors,
      options.recordTypes,
      options.actions,
    );
  }
}
