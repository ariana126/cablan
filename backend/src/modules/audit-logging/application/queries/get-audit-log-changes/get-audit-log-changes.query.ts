import { Identity } from '@framework/domain';

export class GetAuditLogChangesQuery {
  constructor(public readonly auditLogEntryId: Identity) {}
}
