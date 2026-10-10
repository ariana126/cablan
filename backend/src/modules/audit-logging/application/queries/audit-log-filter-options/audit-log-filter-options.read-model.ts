import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';

export class AuditLogFilterOptions {
  constructor(
    public readonly actors: string[],
    public readonly recordTypes: AuditRecordType[],
    public readonly actions: AuditAction[],
  ) {}
}
