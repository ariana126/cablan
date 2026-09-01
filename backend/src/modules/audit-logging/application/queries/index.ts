import { GetAuditLogChangesHandler } from '@audit-logging/application/queries/get-audit-log-changes/get-audit-log-changes.handler';
import { ListAuditLogHandler } from '@audit-logging/application/queries/list-audit-log/list-audit-log.handler';

export const QueryHandlers = [ListAuditLogHandler, GetAuditLogChangesHandler];
