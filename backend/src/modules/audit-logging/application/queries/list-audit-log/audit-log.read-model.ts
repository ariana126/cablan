import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';

export class AuditLogEntryItem {
  constructor(
    public readonly id: string,
    public readonly occurredAt: string,
    public readonly actorName: string,
    public readonly recordType: AuditRecordType,
    public readonly recordId: string,
    public readonly action: AuditAction,
  ) {}
}

export class AuditLogPage {
  constructor(
    public readonly items: AuditLogEntryItem[],
    public readonly total: number,
  ) {}
}
