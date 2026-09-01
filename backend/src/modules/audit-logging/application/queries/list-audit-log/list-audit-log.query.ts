// `to`, if given, is the *calendar day* filter's raw upper bound — still an
// instant at this point, not yet adjusted to the exclusive start-of-next-day
// boundary `ListAuditLogHandler` computes before calling
// `AuditLogRepository.search()`. See that handler's own doc comment.
export interface ListAuditLogFilters {
  readonly actorName?: string;
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
