import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';

// `to`, if given, is the *calendar day* filter's raw upper bound — still an
// instant at this point, not yet adjusted to the exclusive start-of-next-day
// boundary `ListAuditLogHandler` computes before calling
// `AuditLogRepository.search()`. See that handler's own doc comment.
//
// A multi-value filter left `undefined` means "unfiltered"; an empty array
// means "match nothing".
export interface ListAuditLogFilters {
  readonly actors?: string[];
  readonly recordTypes?: AuditRecordType[];
  readonly actions?: AuditAction[];
  readonly recordId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export class ListAuditLogQuery {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
    public readonly filters: ListAuditLogFilters,
  ) {}
}
